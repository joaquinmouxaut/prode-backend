import { Injectable } from '@nestjs/common';
import { Phase, Role } from '@prisma/client';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

const KNOCKOUT_PHASES = new Set<Phase>([
  Phase.ROUND_OF_32,
  Phase.ROUND_OF_16,
  Phase.QUARTER_FINAL,
  Phase.SEMI_FINAL,
  Phase.THIRD_PLACE,
  Phase.FINAL,
]);

export type LeaderboardRow = {
  user: {
    id: number;
    name: string;
    email: string;
    championPick: string | null;
    topScorerPick: string | null;
  };
  total: number;
  matchPoints: number;
  championPoints: number;
  topScorerPoints: number;
  groupsPoints: number;
  knockoutPoints: number;
  byPhase: Partial<Record<Phase, number>>;
};

export type LeaderboardResponse = {
  tournamentPicksVisible: boolean;
  rows: LeaderboardRow[];
};

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchLifecycle: MatchLifecycleService,
  ) {}

  async findAll(): Promise<LeaderboardResponse> {
    const tournamentPicksVisible =
      await this.matchLifecycle.hasTournamentStarted();

    const [users, knockoutByUser] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.USER },
        select: {
          id: true,
          name: true,
          email: true,
          championPick: true,
          topScorerPick: true,
          totalPoints: true,
          championPoints: true,
          topScorerPoints: true,
          groups1: true,
          groups2: true,
          groups3: true,
          knockout: true,
        },
        orderBy: [
          { totalPoints: 'desc' },
          { knockout: 'desc' },
          { groups3: 'desc' },
          { groups2: 'desc' },
          { groups1: 'desc' },
          { name: 'asc' },
          { id: 'asc' },
        ],
      }),
      this.loadKnockoutByPhase(),
    ]);

    return {
      tournamentPicksVisible,
      rows: users.map((user) => ({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          championPick: tournamentPicksVisible ? user.championPick : null,
          topScorerPick: tournamentPicksVisible ? user.topScorerPick : null,
        },
        total: user.totalPoints,
        matchPoints: user.groups1 + user.groups2 + user.groups3 + user.knockout,
        championPoints: user.championPoints,
        topScorerPoints: user.topScorerPoints,
        groupsPoints: user.groups1 + user.groups2 + user.groups3,
        knockoutPoints: user.knockout,
        byPhase: {
          [Phase.GROUPS_1]: user.groups1,
          [Phase.GROUPS_2]: user.groups2,
          [Phase.GROUPS_3]: user.groups3,
          ...(knockoutByUser.get(user.id) ?? {}),
        },
      })),
    };
  }

  private async loadKnockoutByPhase(): Promise<
    Map<number, Partial<Record<Phase, number>>>
  > {
    const predictions = await this.prisma.prediction.findMany({
      where: { user: { role: Role.USER } },
      select: {
        userId: true,
        points: true,
        match: { select: { phase: true } },
      },
    });

    const byUser = new Map<number, Partial<Record<Phase, number>>>();

    for (const prediction of predictions) {
      const phase = prediction.match.phase;
      if (!KNOCKOUT_PHASES.has(phase)) {
        continue;
      }

      const userPhases = byUser.get(prediction.userId) ?? {};
      userPhases[phase] = (userPhases[phase] ?? 0) + prediction.points;
      byUser.set(prediction.userId, userPhases);
    }

    return byUser;
  }
}
