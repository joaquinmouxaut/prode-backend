import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PredictionsService } from './predictions.service';

describe('PredictionsService locks', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    prediction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    match: { findMany: jest.fn() },
  };
  const matchLifecycle = {
    ensureMatchOpenForPredictions: jest.fn(),
    ensureTournamentPicksOpen: jest.fn(),
  };
  let service: PredictionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PredictionsService(
      prisma as never,
      matchLifecycle as unknown as MatchLifecycleService,
    );
  });

  it('rejects creating a prediction after kickoff', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    matchLifecycle.ensureMatchOpenForPredictions.mockRejectedValue(
      new ConflictException('Predictions are locked after kickoff'),
    );

    await expect(
      service.create({ userId: 1, matchId: 9, homeGoals: 1, awayGoals: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.prediction.create).not.toHaveBeenCalled();
  });

  it('rejects updating a prediction after kickoff', async () => {
    prisma.prediction.findUnique.mockResolvedValue({
      id: 5,
      matchId: 9,
      userId: 1,
      homeGoals: 1,
      awayGoals: 0,
      points: 0,
      user: { id: 1, name: 'Ana', email: 'a@x.com' },
      match: {
        id: 9,
        homeTeam: 'A',
        awayTeam: 'B',
        homeGoals: 0,
        awayGoals: 0,
        date: new Date(),
        phase: 'GROUPS_1',
        externalStatus: 'IN_PLAY',
      },
    });
    matchLifecycle.ensureMatchOpenForPredictions.mockRejectedValue(
      new ConflictException('Predictions are locked after kickoff'),
    );

    await expect(
      service.update(5, { homeGoals: 2, awayGoals: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.prediction.update).not.toHaveBeenCalled();
  });

  it('excludes admin users from visible group predictions after kickoff', async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: 1,
        date: new Date('2026-06-11T19:00:00.000Z'),
        externalStatus: 'IN_PLAY',
      },
    ]);
    prisma.prediction.findMany.mockResolvedValue([]);

    await service.findVisible(2);

    expect(prisma.prediction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [{ userId: 2 }, { matchId: { in: [1] } }],
            },
            {
              OR: [{ userId: 2 }, { user: { role: Role.USER } }],
            },
          ],
        },
      }),
    );
  });
});
