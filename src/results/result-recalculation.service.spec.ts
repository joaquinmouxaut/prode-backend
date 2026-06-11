import { ConflictException } from '@nestjs/common';
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
      externalStatus: 'IN_PLAY',
      lastSyncedAt: new Date('2026-06-20T10:00:00.000Z'),
      finalizedAt: null,
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

  it('skips API updates when match is manually finalized', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 10,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      homeGoals: 1,
      awayGoals: 1,
      externalStatus: 'FINISHED',
      lastSyncedAt: new Date('2026-06-20T10:00:00.000Z'),
      finalizedAt: new Date('2026-06-20T20:00:00.000Z'),
    });

    const service = createService(prisma);
    const result = await service.applyExternalResult({
      externalId: 'ext-10',
      homeGoals: 1,
      awayGoals: 1,
      externalStatus: 'FINISHED',
      syncedAt: new Date(),
    });

    expect(result).toEqual({
      matched: true,
      matchId: 10,
      recalculatedPredictions: 0,
      recalculatedUsers: 0,
      skipped: 'match_finalized',
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('applies final score when a finished match is still missing goals', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 1,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-11T19:00:00.000Z'),
      homeGoals: null,
      awayGoals: null,
      externalStatus: 'FINISHED',
      lastSyncedAt: new Date('2026-06-11T21:27:00.000Z'),
      finalizedAt: null,
    });
    prisma.match.update.mockResolvedValue({});
    prisma.prediction.findMany.mockResolvedValue([
      { id: 100, userId: 1, homeGoals: 2, awayGoals: 0 },
    ]);
    prisma.prediction.update.mockResolvedValue({});

    const userTotals = createUserTotalsMock();
    const service = new ResultRecalculationService(
      prisma as never,
      new PointsService(),
      userTotals as never,
    );
    const result = await service.applyExternalResult({
      externalId: '537327',
      homeGoals: 2,
      awayGoals: 0,
      externalStatus: 'FINISHED',
      syncedAt: new Date('2026-06-11T22:00:00.000Z'),
    });

    expect(result).toMatchObject({
      matched: true,
      matchId: 1,
      recalculatedPredictions: 1,
      recalculatedUsers: 1,
    });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        homeGoals: 2,
        awayGoals: 0,
        externalStatus: 'FINISHED',
        resultSource: 'API',
      }),
    });
  });

  it('skips API updates when the incoming update is stale', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 10,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      homeGoals: 1,
      awayGoals: 1,
      externalStatus: '1H',
      lastSyncedAt: new Date('2026-06-20T12:00:00.000Z'),
      finalizedAt: null,
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
      finalizedAt: null,
    });
    prisma.match.update.mockResolvedValue({
      id: 11,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 2,
      awayGoals: 1,
      finalizedAt: null,
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

  it('ignores stale TIMED payloads that would wipe live scores', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 1,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-11T19:00:00.000Z'),
      homeGoals: 0,
      awayGoals: 0,
      externalStatus: 'IN_PLAY',
      lastSyncedAt: new Date('2026-06-11T19:30:00.000Z'),
      finalizedAt: null,
    });
    prisma.match.update.mockResolvedValue({});
    prisma.prediction.findMany.mockResolvedValue([]);

    const service = createService(prisma);
    const result = await service.applyExternalResult({
      externalId: '537327',
      homeGoals: null,
      awayGoals: null,
      externalStatus: 'TIMED',
      syncedAt: new Date('2026-06-11T19:35:00.000Z'),
    });

    expect(result).toMatchObject({
      matched: true,
      skipped: 'no_score_change',
    });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        externalStatus: 'IN_PLAY',
        homeGoals: 0,
        awayGoals: 0,
        resultSource: 'API',
      }),
    });
  });

  it('blocks manual updates once a match is finalized', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 12,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'FINISHED',
      homeGoals: 2,
      awayGoals: 1,
      lastSyncedAt: new Date('2026-06-20T20:00:00.000Z'),
      finalizedAt: new Date('2026-06-20T20:05:00.000Z'),
    });

    const service = createService(prisma);
    await expect(
      service.applyMatchResult({
        matchId: 12,
        homeGoals: 3,
        awayGoals: 1,
        source: 'ADMIN',
        syncedAt: new Date('2026-06-20T21:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finalizes a match with a complete score and recalculates points', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 13,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 2,
      awayGoals: 1,
      lastSyncedAt: new Date('2026-06-20T19:00:00.000Z'),
      finalizedAt: null,
    });
    prisma.match.update.mockResolvedValue({});
    prisma.prediction.findMany.mockResolvedValue([
      { id: 200, userId: 5, homeGoals: 2, awayGoals: 1 },
    ]);
    prisma.prediction.update.mockResolvedValue({});

    const userTotals = createUserTotalsMock();
    const service = new ResultRecalculationService(
      prisma as never,
      new PointsService(),
      userTotals as never,
    );
    const result = await service.finalizeMatch(13);

    expect(result).toMatchObject({
      matchId: 13,
      recalculatedPredictions: 1,
      recalculatedUsers: 1,
    });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 13 },
      data: expect.objectContaining({
        externalStatus: 'FINISHED',
        finalizedAt: expect.any(Date),
      }),
    });
  });

  it('clears finalizedAt when unfinalizing a match', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 14,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'FINISHED',
      homeGoals: 2,
      awayGoals: 1,
      lastSyncedAt: new Date('2026-06-20T20:00:00.000Z'),
      finalizedAt: new Date('2026-06-20T20:05:00.000Z'),
    });
    prisma.match.update.mockResolvedValue({});

    const service = createService(prisma);
    const result = await service.unfinalizeMatch(14);

    expect(result).toEqual({ matchId: 14 });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 14 },
      data: { finalizedAt: null },
    });
  });

  it('rejects unfinalize when match is not finalized', async () => {
    const prisma = createPrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: 15,
      phase: Phase.GROUPS_1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 1,
      awayGoals: 0,
      lastSyncedAt: new Date('2026-06-20T19:00:00.000Z'),
      finalizedAt: null,
    });

    const service = createService(prisma);
    await expect(service.unfinalizeMatch(15)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
