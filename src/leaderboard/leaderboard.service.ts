import { Injectable } from '@nestjs/common';
import { Phase } from '@prisma/client';
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
  groupsPoints: number;
  knockoutPoints: number;
  byPhase: Partial<Record<Phase, number>>;
};

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<LeaderboardRow[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        championPick: true,
        topScorerPick: true,
        totalPoints: true,
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

    return users.map((user) => ({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        championPick: user.championPick,
        topScorerPick: user.topScorerPick,
      },
      total: user.totalPoints,
      groupsPoints: user.groups1 + user.groups2 + user.groups3,
      knockoutPoints: user.knockout,
      byPhase: {
        [Phase.GROUPS_1]: user.groups1,
        [Phase.GROUPS_2]: user.groups2,
        [Phase.GROUPS_3]: user.groups3,
      },
    }));
  }
}
