import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isMatchStarted } from '../matches/match-lifecycle';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';

const predictionInclude = {
  user: { select: { id: true, name: true, email: true } },
  match: {
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      homeGoals: true,
      awayGoals: true,
      date: true,
      phase: true,
      externalStatus: true,
    },
  },
} as const;

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchLifecycle: MatchLifecycleService,
  ) {}

  async findVisible(
    viewerUserId: number,
    filters?: { userId?: number; matchId?: number },
  ) {
    if (filters?.matchId !== undefined) {
      const match = await this.prisma.match.findUnique({
        where: { id: filters.matchId },
        select: {
          id: true,
          date: true,
          externalStatus: true,
        },
      });
      if (!match) {
        throw new NotFoundException(`Match ${filters.matchId} not found`);
      }

      const started = isMatchStarted(match);
      if (
        filters.userId !== undefined &&
        filters.userId !== viewerUserId &&
        !started
      ) {
        throw new ForbiddenException(
          'Predictions for other users are visible only after kickoff',
        );
      }

      return this.prisma.prediction.findMany({
        where: {
          matchId: filters.matchId,
          ...(filters.userId !== undefined ? { userId: filters.userId } : {}),
          ...(started ? {} : { userId: viewerUserId }),
        },
        include: predictionInclude,
        orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
      });
    }

    if (filters?.userId !== undefined && filters.userId !== viewerUserId) {
      const startedMatchIds = await this.getStartedMatchIds();

      return this.prisma.prediction.findMany({
        where: {
          userId: filters.userId,
          matchId: { in: startedMatchIds },
        },
        include: predictionInclude,
        orderBy: [{ match: { date: 'asc' } }, { matchId: 'asc' }],
      });
    }

    const matches = await this.prisma.match.findMany({
      select: {
        id: true,
        date: true,
        externalStatus: true,
      },
    });
    const startedMatchIds = matches
      .filter((match) => isMatchStarted(match))
      .map((match) => match.id);

    return this.prisma.prediction.findMany({
      where: {
        OR: [
          { userId: viewerUserId },
          { matchId: { in: startedMatchIds } },
        ],
      },
      include: predictionInclude,
      orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
    });
  }

  findAll(filters?: { userId?: number; matchId?: number }) {
    return this.prisma.prediction.findMany({
      where: {
        ...(filters?.userId !== undefined ? { userId: filters.userId } : {}),
        ...(filters?.matchId !== undefined ? { matchId: filters.matchId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        match: {
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            homeGoals: true,
            awayGoals: true,
            date: true,
            phase: true,
          },
        },
      },
      orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
    });
  }

  async findOne(id: number) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        match: {
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            homeGoals: true,
            awayGoals: true,
            date: true,
            phase: true,
            externalStatus: true,
          },
        },
      },
    });
    if (!prediction) {
      throw new NotFoundException(`Prediction ${id} not found`);
    }
    return prediction;
  }

  async create(dto: CreatePredictionDto) {
    await this.ensureUserExists(dto.userId);
    await this.matchLifecycle.ensureMatchOpenForPredictions(dto.matchId);
    try {
      return await this.prisma.prediction.create({
        data: {
          userId: dto.userId,
          matchId: dto.matchId,
          homeGoals: dto.homeGoals,
          awayGoals: dto.awayGoals,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          match: {
            select: {
              id: true,
              homeTeam: true,
              awayTeam: true,
              homeGoals: true,
              awayGoals: true,
              date: true,
              phase: true,
            },
          },
        },
      });
    } catch (e: unknown) {
      if (this.isUniqueConstraint(e)) {
        throw new ConflictException(
          `User ${dto.userId} already has a prediction for match ${dto.matchId}`,
        );
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdatePredictionDto) {
    const prediction = await this.findOne(id);
    await this.matchLifecycle.ensureMatchOpenForPredictions(prediction.matchId);
    return this.prisma.prediction.update({
      where: { id },
      data: dto,
      include: {
        user: { select: { id: true, name: true, email: true } },
        match: {
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            homeGoals: true,
            awayGoals: true,
            date: true,
            phase: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    const prediction = await this.findOne(id);
    await this.matchLifecycle.ensureMatchOpenForPredictions(prediction.matchId);
    return this.prisma.prediction.delete({ where: { id } });
  }

  private async getStartedMatchIds(): Promise<number[]> {
    const matches = await this.prisma.match.findMany({
      select: {
        id: true,
        date: true,
        externalStatus: true,
      },
    });

    return matches
      .filter((match) => isMatchStarted(match))
      .map((match) => match.id);
  }

  private async ensureUserExists(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  private isUniqueConstraint(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    );
  }
}
