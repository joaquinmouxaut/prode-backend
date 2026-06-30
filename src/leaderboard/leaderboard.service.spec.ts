import { Phase, Role } from '@prisma/client';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService', () => {
  const findMany = jest.fn();
  const predictionFindMany = jest.fn();
  const hasTournamentStarted = jest.fn();
  let service: LeaderboardService;

  beforeEach(() => {
    findMany.mockReset();
    predictionFindMany.mockReset();
    hasTournamentStarted.mockReset();
    hasTournamentStarted.mockResolvedValue(true);
    predictionFindMany.mockResolvedValue([]);
    service = new LeaderboardService(
      {
        user: { findMany },
        prediction: { findMany: predictionFindMany },
      } as unknown as PrismaService,
      {
        hasTournamentStarted,
      } as unknown as MatchLifecycleService,
    );
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

    await expect(service.findAll()).resolves.toEqual({
      tournamentPicksVisible: true,
      rows: [
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
      ],
    });
  });

  it('hides tournament picks before the first kickoff', async () => {
    hasTournamentStarted.mockResolvedValue(false);
    findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Ana',
        email: 'ana@example.com',
        championPick: 'Argentina',
        topScorerPick: 'Messi',
        totalPoints: 0,
        championPoints: 0,
        topScorerPoints: 0,
        groups1: 0,
        groups2: 0,
        groups3: 0,
        knockout: 0,
      },
    ]);

    const result = await service.findAll();

    expect(result.tournamentPicksVisible).toBe(false);
    expect(result.rows[0].user.championPick).toBeNull();
    expect(result.rows[0].user.topScorerPick).toBeNull();
  });

  it('includes knockout round breakdown in byPhase', async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Ana',
        email: 'ana@example.com',
        championPick: null,
        topScorerPick: null,
        totalPoints: 40,
        championPoints: 0,
        topScorerPoints: 0,
        groups1: 0,
        groups2: 0,
        groups3: 0,
        knockout: 40,
      },
    ]);
    predictionFindMany.mockResolvedValue([
      {
        userId: 1,
        points: 16,
        match: { phase: Phase.ROUND_OF_16 },
      },
      {
        userId: 1,
        points: 24,
        match: { phase: Phase.FINAL },
      },
    ]);

    const result = await service.findAll();

    expect(predictionFindMany).toHaveBeenCalled();
    expect(result.rows[0].byPhase).toEqual({
      [Phase.GROUPS_1]: 0,
      [Phase.GROUPS_2]: 0,
      [Phase.GROUPS_3]: 0,
      [Phase.ROUND_OF_16]: 16,
      [Phase.FINAL]: 24,
    });
  });
});
