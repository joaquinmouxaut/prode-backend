import { Phase } from '@prisma/client';
import { PointsService } from '../points/points.service';
import { ResultRecalculationService } from './result-recalculation.service';

function createPrismaMock() {
  return {
    match: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prediction: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  };
}

describe('ResultRecalculationService', () => {
  it('skips API updates when match is manually overridden', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 10,
      phase: Phase.GROUPS_1,
      homeGoals: 1,
      awayGoals: 1,
      manualOverride: true,
    });

    const service = new ResultRecalculationService(
      prisma as never,
      new PointsService(),
    );
    const result = await service.applyExternalResult({
      externalId: 'ext-10',
      homeGoals: 2,
      awayGoals: 1,
      externalStatus: 'FT',
      syncedAt: new Date(),
    });

    expect(result).toEqual({
      matched: true,
      matchId: 10,
      recalculatedPredictions: 0,
      recalculatedUsers: 0,
      skipped: 'manual_override',
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('recalculates only predictions for the updated match', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 11,
      phase: Phase.GROUPS_1,
      homeGoals: 0,
      awayGoals: 0,
      manualOverride: false,
    });
    prisma.match.update.mockResolvedValue({
      id: 11,
      phase: Phase.GROUPS_1,
      homeGoals: 2,
      awayGoals: 1,
    });
    prisma.prediction.findMany
      .mockResolvedValueOnce([
        { id: 100, userId: 1, homeGoals: 2, awayGoals: 1 },
        { id: 101, userId: 2, homeGoals: 1, awayGoals: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: 1, points: 12, match: { phase: Phase.GROUPS_1 } },
        { userId: 2, points: 4, match: { phase: Phase.GROUPS_1 } },
      ]);
    prisma.prediction.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    const service = new ResultRecalculationService(
      prisma as never,
      new PointsService(),
    );
    const result = await service.applyMatchResult({
      matchId: 11,
      homeGoals: 2,
      awayGoals: 1,
      source: 'ADMIN',
      bypassManualOverride: true,
      setManualOverride: true,
      externalStatus: 'MANUAL',
    });

    expect(result).toMatchObject({
      matchId: 11,
      recalculatedPredictions: 2,
      recalculatedUsers: 2,
    });
    expect(prisma.prediction.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.prediction.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });
});
