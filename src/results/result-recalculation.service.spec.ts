import { Phase } from '@prisma/client';
import { PointsService } from '../points/points.service';
import { UserTotalsService } from '../tournament/user-totals.service';
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
    $transaction: jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  };
}

function createUserTotalsMock() {
  return {
    recomputeForUsers: jest.fn().mockResolvedValue([]),
  };
}

function createService(prisma = createPrismaMock()) {
  return new ResultRecalculationService(
    prisma as never,
    new PointsService(),
    createUserTotalsMock() as never,
  );
}

describe('ResultRecalculationService', () => {
  it('continues API updates after a manual admin sync during the active window', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 10,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      homeGoals: 1,
      awayGoals: 0,
      manualOverride: true,
      externalStatus: 'IN_PLAY',
      lastSyncedAt: new Date('2026-06-20T10:00:00.000Z'),
    });
    prisma.match.update.mockResolvedValue({});
    prisma.prediction.findMany.mockResolvedValue([]);

    const service = createService(prisma);
    const result = await service.applyExternalResult({
      externalId: 'ext-10',
      homeGoals: 2,
      awayGoals: 1,
      externalStatus: 'IN_PLAY',
      syncedAt: new Date('2026-06-20T18:30:00.000Z'),
    });

    expect(result).toMatchObject({
      matched: true,
      matchId: 10,
      recalculatedPredictions: 0,
      recalculatedUsers: 0,
    });
    expect(prisma.match.update).toHaveBeenCalled();
  });

  it('skips API updates when match is already finalized', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 10,
      phase: Phase.GROUPS_1,
      homeGoals: 1,
      awayGoals: 1,
      manualOverride: false,
      externalStatus: 'FINISHED',
      lastSyncedAt: new Date('2026-06-20T10:00:00.000Z'),
    });

    const service = createService(prisma);
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
      skipped: 'already_finalized',
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('skips API updates when the incoming update is stale', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 10,
      phase: Phase.GROUPS_1,
      homeGoals: 1,
      awayGoals: 1,
      manualOverride: false,
      externalStatus: '1H',
      lastSyncedAt: new Date('2026-06-20T12:00:00.000Z'),
    });

    const service = createService(prisma);
    const result = await service.applyExternalResult({
      externalId: 'ext-10',
      homeGoals: 2,
      awayGoals: 1,
      externalStatus: 'FINISHED',
      syncedAt: new Date('2026-06-20T11:59:00.000Z'),
    });

    expect(result).toEqual({
      matched: true,
      matchId: 10,
      recalculatedPredictions: 0,
      recalculatedUsers: 0,
      skipped: 'stale_update',
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('recalculates only predictions for the updated match', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 11,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 0,
      awayGoals: 0,
      lastSyncedAt: new Date('2026-06-20T09:00:00.000Z'),
    });
    prisma.match.update.mockResolvedValue({
      id: 11,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 2,
      awayGoals: 1,
    });
    prisma.prediction.findMany.mockResolvedValueOnce([
      { id: 100, userId: 1, homeGoals: 2, awayGoals: 1 },
      { id: 101, userId: 2, homeGoals: 3, awayGoals: 0 },
    ]);
    prisma.prediction.update.mockResolvedValue({});

    const userTotals = createUserTotalsMock();
    const service = new ResultRecalculationService(
      prisma as never,
      new PointsService(),
      userTotals as never,
    );
    const result = await service.applyMatchResult({
      matchId: 11,
      homeGoals: 2,
      awayGoals: 1,
      source: 'ADMIN',
      externalStatus: 'IN_PLAY',
      syncedAt: new Date('2026-06-20T09:05:00.000Z'),
    });

    expect(result).toMatchObject({
      matchId: 11,
      recalculatedPredictions: 2,
      recalculatedUsers: 2,
    });
    expect(prisma.prediction.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.prediction.update).toHaveBeenCalledTimes(2);
    expect(userTotals.recomputeForUsers).toHaveBeenCalledWith([1, 2]);
  });
});
