import { Injectable } from '@nestjs/common';
import { Phase } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { picksMatch } from './pick-normalize';
import { TOURNAMENT_BONUS_POINTS } from './tournament.constants';

type MatchTotals = {
  groups1: number;
  groups2: number;
  groups3: number;
  knockout: number;
  matchPoints: number;
};

@Injectable()
export class UserTotalsService {
  constructor(private readonly prisma: PrismaService) {}

  aggregateMatchPoints(
    predictions: Array<{ points: number; match: { phase: Phase } }>,
  ): MatchTotals {
    const totals: MatchTotals = {
      groups1: 0,
      groups2: 0,
      groups3: 0,
      knockout: 0,
      matchPoints: 0,
    };

    for (const prediction of predictions) {
      totals.matchPoints += prediction.points;
      if (prediction.match.phase === Phase.GROUPS_1) {
        totals.groups1 += prediction.points;
      } else if (prediction.match.phase === Phase.GROUPS_2) {
        totals.groups2 += prediction.points;
      } else if (prediction.match.phase === Phase.GROUPS_3) {
        totals.groups3 += prediction.points;
      } else {
        totals.knockout += prediction.points;
      }
    }

    return totals;
  }

  computeTournamentBonuses(
    user: { championPick: string | null; topScorerPick: string | null },
    config: { championTeam: string | null; topScorerPlayer: string | null },
  ) {
    return {
      championPoints: picksMatch(user.championPick, config.championTeam)
        ? TOURNAMENT_BONUS_POINTS.CHAMPION
        : 0,
      topScorerPoints: picksMatch(user.topScorerPick, config.topScorerPlayer)
        ? TOURNAMENT_BONUS_POINTS.TOP_SCORER
        : 0,
    };
  }

  async getTournamentConfig() {
    return this.prisma.tournamentConfig.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  async recomputeForUser(userId: number) {
    const [user, predictions, config] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          championPick: true,
          topScorerPick: true,
        },
      }),
      this.prisma.prediction.findMany({
        where: { userId },
        select: {
          points: true,
          match: { select: { phase: true } },
        },
      }),
      this.getTournamentConfig(),
    ]);

    if (!user) {
      return null;
    }

    const matchTotals = this.aggregateMatchPoints(predictions);
    const bonuses = this.computeTournamentBonuses(user, config);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups1: matchTotals.groups1,
        groups2: matchTotals.groups2,
        groups3: matchTotals.groups3,
        knockout: matchTotals.knockout,
        championPoints: bonuses.championPoints,
        topScorerPoints: bonuses.topScorerPoints,
        totalPoints:
          matchTotals.matchPoints +
          bonuses.championPoints +
          bonuses.topScorerPoints,
      },
    });

    return { userId, ...matchTotals, ...bonuses };
  }

  async recomputeForUsers(userIds: number[]) {
    const uniqueUserIds = Array.from(new Set(userIds));
    const results: NonNullable<
      Awaited<ReturnType<UserTotalsService['recomputeForUser']>>
    >[] = [];

    for (const userId of uniqueUserIds) {
      const result = await this.recomputeForUser(userId);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  async recomputeAllUsers() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return this.recomputeForUsers(users.map((user) => user.id));
  }
}
