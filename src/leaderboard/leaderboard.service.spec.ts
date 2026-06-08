import { Phase, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService', () => {
  const findMany = jest.fn();
  let service: LeaderboardService;

  beforeEach(() => {
    findMany.mockReset();
    service = new LeaderboardService({
      user: { findMany },
    } as unknown as PrismaService);
  });

  it('reads users with the ranking order and tie-breakers', async () => {
    findMany.mockResolvedValue([]);

    await service.findAll();

    expect(findMany).toHaveBeenCalledWith({
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
  });

  it('maps persisted user totals to leaderboard rows', async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Ana',
        email: 'ana@example.com',
        championPick: 'Argentina',
        topScorerPick: null,
        totalPoints: 74,
        championPoints: 50,
        topScorerPoints: 0,
        groups1: 8,
        groups2: 10,
        groups3: 6,
        knockout: 0,
      },
    ]);

    await expect(service.findAll()).resolves.toEqual([
      {
        user: {
          id: 1,
          name: 'Ana',
          email: 'ana@example.com',
          championPick: 'Argentina',
          topScorerPick: null,
        },
        total: 74,
        matchPoints: 24,
        championPoints: 50,
        topScorerPoints: 0,
        groupsPoints: 24,
        knockoutPoints: 0,
        byPhase: {
          [Phase.GROUPS_1]: 8,
          [Phase.GROUPS_2]: 10,
          [Phase.GROUPS_3]: 6,
        },
      },
    ]);
  });
});
