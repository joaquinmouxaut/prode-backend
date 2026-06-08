import { Injectable, NotFoundException } from '@nestjs/common';
import { hasScoreableResult, isMatchStarted } from '../matches/match-lifecycle';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserTotalsService } from '../tournament/user-totals.service';

type ApplyMatchResultInput = {
  matchId: number;
  homeGoals: number;
  awayGoals: number;
  source: 'ADMIN' | 'API' | 'IMPORT';
  externalStatus?: string | null;
  syncedAt?: Date;
};

type ApplyExternalResultInput = {
  externalId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  externalStatus: string;
  syncedAt: Date;
};

type MatchResultSource = 'ADMIN' | 'API' | 'IMPORT';

@Injectable()
export class ResultRecalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly userTotals: UserTotalsService,
  ) {}

  private readonly finalStatuses = new Set([
    'FINISHED',
    'AWARDED',
    'CANCELLED',
  ]);

  private isFinalizedStatus(status: string | null | undefined): boolean {
    if (!status) {
      return false;
    }
    return this.finalStatuses.has(status.toUpperCase());
  }

  async applyMatchResult(input: ApplyMatchResultInput) {
    const existingMatch = await this.prisma.match.findUnique({
      where: { id: input.matchId },
      select: {
        id: true,
        phase: true,
        date: true,
        externalStatus: true,
        homeGoals: true,
        awayGoals: true,
        lastSyncedAt: true,
      },
    });

    if (!existingMatch) {
      throw new NotFoundException(`Match ${input.matchId} not found`);
    }

    const syncedAt = input.syncedAt ?? new Date();
    if (
      existingMatch.lastSyncedAt &&
      syncedAt.getTime() <= existingMatch.lastSyncedAt.getTime()
    ) {
      return {
        matchId: input.matchId,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'stale_update',
      } as const;
    }

    const hasScoreChange =
      existingMatch.homeGoals !== input.homeGoals ||
      existingMatch.awayGoals !== input.awayGoals;

    const wasScoreable = hasScoreableResult(existingMatch);

    const match = await this.prisma.match.update({
      where: { id: input.matchId },
      data: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        resultSource: input.source,
        lastSyncedAt: syncedAt,
        ...(input.source === 'ADMIN' ? { manualOverride: true } : {}),
        ...(input.externalStatus !== undefined
          ? { externalStatus: input.externalStatus ?? null }
          : {}),
      },
      select: {
        id: true,
        phase: true,
        date: true,
        externalStatus: true,
        homeGoals: true,
        awayGoals: true,
      },
    });

    const isScoreable = hasScoreableResult(match);

    if (!isScoreable) {
      return {
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'match_not_started',
      } as const;
    }

    if (!hasScoreChange && !(isScoreable && !wasScoreable)) {
      return {
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'no_score_change',
      } as const;
    }

    return this.recalculateForMatch(
      match.id,
      match.phase,
      match.homeGoals,
      match.awayGoals,
    );
  }

  async applyExternalResult(input: ApplyExternalResultInput) {
    const match = await this.prisma.match.findUnique({
      where: { externalId: input.externalId },
      select: {
        id: true,
        phase: true,
        date: true,
        homeGoals: true,
        awayGoals: true,
        manualOverride: true,
        externalStatus: true,
        lastSyncedAt: true,
      },
    });

    if (!match) {
      return {
        matched: false,
        reason: 'match_not_found',
      } as const;
    }

    if (this.isFinalizedStatus(match.externalStatus)) {
      return {
        matched: true,
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'already_finalized',
      } as const;
    }

    if (
      match.lastSyncedAt &&
      input.syncedAt.getTime() <= match.lastSyncedAt.getTime()
    ) {
      return {
        matched: true,
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'stale_update',
      } as const;
    }

    const wasScoreable = hasScoreableResult({
      date: match.date,
      externalStatus: match.externalStatus,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
    });

    const nextMatch = {
      date: match.date,
      externalStatus: input.externalStatus,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
    };

    if (!isMatchStarted(nextMatch)) {
      await this.prisma.match.update({
        where: { id: match.id },
        data: {
          externalStatus: input.externalStatus,
          lastSyncedAt: input.syncedAt,
        },
      });

      return {
        matched: true,
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'match_not_started',
      } as const;
    }

    const hasScoreChange =
      match.homeGoals !== input.homeGoals ||
      match.awayGoals !== input.awayGoals;

    await this.prisma.match.update({
      where: { id: match.id },
      data: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        externalStatus: input.externalStatus,
        resultSource: 'API' as MatchResultSource,
        lastSyncedAt: input.syncedAt,
      },
    });

    const isScoreable = hasScoreableResult(nextMatch);

    if (
      !isScoreable ||
      input.homeGoals === null ||
      input.awayGoals === null
    ) {
      return {
        matched: true,
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: isScoreable ? 'missing_score' : 'match_not_started',
      } as const;
    }

    if (!hasScoreChange && !(isScoreable && !wasScoreable)) {
      return {
        matched: true,
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'no_score_change',
      } as const;
    }

    const recalc = await this.recalculateForMatch(
      match.id,
      match.phase,
      input.homeGoals,
      input.awayGoals,
    );

    return { matched: true, ...recalc } as const;
  }

  async clearManualOverride(matchId: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });
    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        manualOverride: false,
        externalStatus: null,
      },
    });

    return { matchId };
  }

  private async recalculateForMatch(
    matchId: number,
    phase: Phase,
    homeGoals: number | null,
    awayGoals: number | null,
  ) {
    const predictions = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { id: true, userId: true, homeGoals: true, awayGoals: true },
    });

    if (predictions.length === 0 || homeGoals === null || awayGoals === null) {
      return {
        matchId,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
      };
    }

    const recalculatedByPredictionId = new Map<number, number>();
    for (const prediction of predictions) {
      const points = this.pointsService.calculatePredictionPoints(
        { homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals },
        { homeGoals, awayGoals, phase },
      );
      recalculatedByPredictionId.set(prediction.id, points);
    }

    await this.prisma.$transaction(
      predictions.map((prediction) =>
        this.prisma.prediction.update({
          where: { id: prediction.id },
          data: { points: recalculatedByPredictionId.get(prediction.id) ?? 0 },
        }),
      ),
    );

    const affectedUserIds = Array.from(
      new Set(predictions.map((prediction) => prediction.userId)),
    );

    await this.userTotals.recomputeForUsers(affectedUserIds);

    return {
      matchId,
      recalculatedPredictions: predictions.length,
      recalculatedUsers: affectedUserIds.length,
    };
  }
}
