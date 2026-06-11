import { Injectable } from '@nestjs/common';
import { Phase, Role } from '@prisma/client';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

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

    const users = await this.prisma.user.findMany({
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
    });

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
        },
      })),
    };
  }
}
