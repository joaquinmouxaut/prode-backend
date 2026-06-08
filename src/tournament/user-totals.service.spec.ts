import { Test, TestingModule } from '@nestjs/testing';
import { Phase } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TOURNAMENT_BONUS_POINTS } from './tournament.constants';
import { UserTotalsService } from './user-totals.service';

describe('UserTotalsService', () => {
  let service: UserTotalsService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    prediction: {
      findMany: jest.fn(),
    },
    tournamentConfig: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTotalsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(UserTotalsService);
  });

  it('awards 50 points for each correct tournament pick', () => {
    const bonuses = service.computeTournamentBonuses(
      { championPick: 'Argentina', topScorerPick: 'Lionel Messi' },
      { championTeam: 'argentina', topScorerPlayer: 'Lionel Messi' },
    );

    expect(bonuses).toEqual({
      championPoints: TOURNAMENT_BONUS_POINTS.CHAMPION,
      topScorerPoints: TOURNAMENT_BONUS_POINTS.TOP_SCORER,
    });
  });

  it('stores match and tournament points in totalPoints', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      championPick: 'Argentina',
      topScorerPick: 'Mbappe',
    });
    prisma.prediction.findMany.mockResolvedValue([
      { points: 8, match: { phase: Phase.GROUPS_1 } },
      { points: 16, match: { phase: Phase.ROUND_OF_16 } },
    ]);
    prisma.tournamentConfig.upsert.mockResolvedValue({
      id: 1,
      championTeam: 'Argentina',
      topScorerPlayer: 'Haaland',
    });
    prisma.user.update.mockResolvedValue({});

    await service.recomputeForUser(1);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        groups1: 8,
        groups2: 0,
        groups3: 0,
        knockout: 16,
        championPoints: 50,
        topScorerPoints: 0,
        totalPoints: 74,
      },
    });
  });
});
