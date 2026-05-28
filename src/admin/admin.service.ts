import { Injectable, NotFoundException } from '@nestjs/common';
import { Phase } from '@prisma/client';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  async setMatchResultAndRecalculate(
    matchId: number,
    homeGoals: number,
    awayGoals: number,
  ) {
    const existingMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });

    if (!existingMatch) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: { homeGoals, awayGoals },
    });

    const allPredictions = await this.prisma.prediction.findMany({
      include: {
        match: {
          select: {
            id: true,
            homeGoals: true,
            awayGoals: true,
            phase: true,
          },
        },
      },
    });

    const predictionUpdates = allPredictions.map((prediction) =>
      this.prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          points: this.pointsService.calculatePredictionPoints(
            {
              homeGoals: prediction.homeGoals,
              awayGoals: prediction.awayGoals,
            },
            prediction.match,
          ),
        },
      }),
    );

    if (predictionUpdates.length > 0) {
      await this.prisma.$transaction(predictionUpdates);
    }

    const refreshedPredictions = await this.prisma.prediction.findMany({
      select: {
        userId: true,
        points: true,
        match: {
          select: {
            phase: true,
          },
        },
      },
    });

    const users = await this.prisma.user.findMany({ select: { id: true } });
    const totalsByUser = new Map<
      number,
      {
        totalPoints: number;
        groups1: number;
        groups2: number;
        groups3: number;
        knockout: number;
      }
    >();

    for (const user of users) {
      totalsByUser.set(user.id, {
        totalPoints: 0,
        groups1: 0,
        groups2: 0,
        groups3: 0,
        knockout: 0,
      });
    }

    for (const prediction of refreshedPredictions) {
      const accumulator = totalsByUser.get(prediction.userId);
      if (!accumulator) {
        continue;
      }

      accumulator.totalPoints += prediction.points;

      if (prediction.match.phase === Phase.GROUPS_1) {
        accumulator.groups1 += prediction.points;
      } else if (prediction.match.phase === Phase.GROUPS_2) {
        accumulator.groups2 += prediction.points;
      } else if (prediction.match.phase === Phase.GROUPS_3) {
        accumulator.groups3 += prediction.points;
      } else {
        accumulator.knockout += prediction.points;
      }
    }

    const userUpdates = Array.from(totalsByUser.entries()).map(
      ([userId, totals]) =>
        this.prisma.user.update({
          where: { id: userId },
          data: totals,
        }),
    );

    if (userUpdates.length > 0) {
      await this.prisma.$transaction(userUpdates);
    }

    return {
      matchId: match.id,
      recalculatedPredictions: allPredictions.length,
      recalculatedUsers: users.length,
    };
  }
}
