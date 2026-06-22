import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchDecision, Phase, TeamSide } from '@prisma/client';
import {
  hasScoreableResult,
  isMatchFinalized,
  isMatchStarted,
} from '../matches/match-lifecycle';
import {
  deriveAdvancingTeam,
  isKnockoutPhase,
} from '../matches/match-phase.util';
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
  winnerSide?: TeamSide | null;
  decidedBy?: MatchDecision | null;
};

type ApplyExternalResultInput = {
  externalId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  externalStatus: string;
  syncedAt: Date;
  winnerSide?: TeamSide | null;
  decidedBy?: MatchDecision | null;
};

type MatchResultSource = 'ADMIN' | 'API' | 'IMPORT';

const matchResultSelect = {
  id: true,
  phase: true,
  date: true,
  externalStatus: true,
  homeGoals: true,
  awayGoals: true,
  lastSyncedAt: true,
  finalizedAt: true,
  winnerSide: true,
  decidedBy: true,
} as const;

@Injectable()
export class ResultRecalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly userTotals: UserTotalsService,
  ) {}

  private resolveExternalStatus(
    incoming: string,
    existing: string | null | undefined,
    kickoff: Date,
    now = new Date(),
  ): string {
    const incomingStatus = incoming.toUpperCase();
    const existingStatus = existing?.toUpperCase();
    const preKickoffStatuses = new Set(['SCHEDULED', 'TIMED']);
    const liveStatuses = new Set([
      'IN_PLAY',
      'PAUSED',
      'EXTRA_TIME',
      'PENALTY_SHOOTOUT',
    ]);

    if (
      existingStatus &&
      liveStatuses.has(existingStatus) &&
      preKickoffStatuses.has(incomingStatus)
    ) {
      return existingStatus;
    }

    if (
      preKickoffStatuses.has(incomingStatus) &&
      kickoff.getTime() <= now.getTime() &&
      existingStatus &&
      liveStatuses.has(existingStatus)
    ) {
      return existingStatus;
    }

    return incomingStatus;
  }

  private resolveIncomingGoals(
    input: { homeGoals: number | null; awayGoals: number | null },
    existing: { homeGoals: number | null; awayGoals: number | null },
  ) {
    const hasCompleteScore =
      input.homeGoals !== null && input.awayGoals !== null;

    if (hasCompleteScore) {
      return {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        hasCompleteScore: true,
      };
    }

    return {
      homeGoals: existing.homeGoals,
      awayGoals: existing.awayGoals,
      hasCompleteScore:
        existing.homeGoals !== null && existing.awayGoals !== null,
    };
  }

  async applyMatchResult(input: ApplyMatchResultInput) {
    const existingMatch = await this.prisma.match.findUnique({
      where: { id: input.matchId },
      select: matchResultSelect,
    });

    if (!existingMatch) {
      throw new NotFoundException(`Match ${input.matchId} not found`);
    }

    if (isMatchFinalized(existingMatch)) {
      throw new ConflictException('Match is finalized and cannot be updated');
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

    const isKnockout = isKnockoutPhase(existingMatch.phase);
    let resolvedWinnerSide: TeamSide | null = null;
    let resolvedDecision: MatchDecision | null = null;
    if (isKnockout) {
      const derived = deriveAdvancingTeam(input.homeGoals, input.awayGoals);
      resolvedWinnerSide = input.winnerSide ?? derived;
      if (!resolvedWinnerSide) {
        throw new ConflictException(
          'Knockout match needs the advancing team when the score is a draw',
        );
      }
      resolvedDecision =
        input.decidedBy ??
        (derived ? MatchDecision.REGULAR : MatchDecision.PENALTIES);
    }

    const hasScoreChange =
      existingMatch.homeGoals !== input.homeGoals ||
      existingMatch.awayGoals !== input.awayGoals ||
      (existingMatch.winnerSide ?? null) !== resolvedWinnerSide;

    const wasScoreable = hasScoreableResult(existingMatch);

    const match = await this.prisma.match.update({
      where: { id: input.matchId },
      data: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        resultSource: input.source,
        lastSyncedAt: syncedAt,
        winnerSide: resolvedWinnerSide,
        decidedBy: resolvedDecision,
        ...(input.externalStatus !== undefined
          ? { externalStatus: input.externalStatus ?? null }
          : {}),
      },
      select: matchResultSelect,
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
      match.winnerSide,
    );
  }

  async applyExternalResult(input: ApplyExternalResultInput) {
    const match = await this.prisma.match.findUnique({
      where: { externalId: input.externalId },
      select: matchResultSelect,
    });

    if (!match) {
      return {
        matched: false,
        reason: 'match_not_found',
      } as const;
    }

    if (isMatchFinalized(match)) {
      return {
        matched: true,
        matchId: match.id,
        recalculatedPredictions: 0,
        recalculatedUsers: 0,
        skipped: 'match_finalized',
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

    const wasScoreable = hasScoreableResult(match);

    const externalStatus = this.resolveExternalStatus(
      input.externalStatus,
      match.externalStatus,
      match.date,
      input.syncedAt,
    );
    const resolvedGoals = this.resolveIncomingGoals(
      {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
      },
      {
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
      },
    );

    const nextMatch = {
      date: match.date,
      externalStatus,
      homeGoals: resolvedGoals.homeGoals,
      awayGoals: resolvedGoals.awayGoals,
      finalizedAt: match.finalizedAt,
    };

    if (!isMatchStarted(nextMatch)) {
      await this.prisma.match.update({
        where: { id: match.id },
        data: {
          externalStatus,
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

    const isKnockout = isKnockoutPhase(match.phase);
    let resolvedWinnerSide = match.winnerSide ?? null;
    if (isKnockout) {
      resolvedWinnerSide =
        input.winnerSide ??
        match.winnerSide ??
        (resolvedGoals.hasCompleteScore
          ? deriveAdvancingTeam(
              resolvedGoals.homeGoals as number,
              resolvedGoals.awayGoals as number,
            )
          : null);
    }
    const resolvedDecision = input.decidedBy ?? match.decidedBy ?? null;

    const hasScoreChange =
      match.homeGoals !== resolvedGoals.homeGoals ||
      match.awayGoals !== resolvedGoals.awayGoals ||
      match.externalStatus !== externalStatus ||
      (match.winnerSide ?? null) !== resolvedWinnerSide;

    const updateData: {
      externalStatus: string;
      lastSyncedAt: Date;
      resultSource: MatchResultSource;
      homeGoals?: number | null;
      awayGoals?: number | null;
      winnerSide?: TeamSide | null;
      decidedBy?: MatchDecision | null;
    } = {
      externalStatus,
      lastSyncedAt: input.syncedAt,
      resultSource: 'API',
      winnerSide: resolvedWinnerSide,
      decidedBy: resolvedDecision,
    };

    if (resolvedGoals.hasCompleteScore) {
      updateData.homeGoals = resolvedGoals.homeGoals;
      updateData.awayGoals = resolvedGoals.awayGoals;
    }

    await this.prisma.match.update({
      where: { id: match.id },
      data: updateData,
    });

    const isScoreable = hasScoreableResult(nextMatch);

    if (!isScoreable || !resolvedGoals.hasCompleteScore) {
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
      resolvedGoals.homeGoals,
      resolvedGoals.awayGoals,
      resolvedWinnerSide,
    );

    return { matched: true, ...recalc } as const;
  }

  async finalizeMatch(matchId: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: matchResultSelect,
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (isMatchFinalized(match)) {
      throw new ConflictException('Match is already finalized');
    }

    if (!hasScoreableResult(match)) {
      throw new ConflictException(
        'Match needs a complete score before it can be finalized',
      );
    }

    const finalizedAt = new Date();
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        finalizedAt,
        externalStatus: 'FINISHED',
      },
    });

    const recalc = await this.recalculateForMatch(
      match.id,
      match.phase,
      match.homeGoals,
      match.awayGoals,
      match.winnerSide,
    );

    return {
      ...recalc,
      finalizedAt: finalizedAt.toISOString(),
    };
  }

  async unfinalizeMatch(matchId: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: matchResultSelect,
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (!isMatchFinalized(match)) {
      throw new ConflictException('Match is not finalized');
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        finalizedAt: null,
      },
    });

    return { matchId };
  }

  async clearManualOverride(matchId: number) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, finalizedAt: true },
    });
    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }
    if (isMatchFinalized(match)) {
      throw new ConflictException('Match is finalized and cannot be updated');
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        manualOverride: false,
      },
    });

    return { matchId };
  }

  private async recalculateForMatch(
    matchId: number,
    phase: Phase,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerSide: TeamSide | null = null,
  ) {
    const predictions = await this.prisma.prediction.findMany({
      where: { matchId },
      select: {
        id: true,
        userId: true,
        homeGoals: true,
        awayGoals: true,
        advancingTeam: true,
      },
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
        {
          homeGoals: prediction.homeGoals,
          awayGoals: prediction.awayGoals,
          advancingTeam: prediction.advancingTeam,
        },
        { homeGoals, awayGoals, phase, winnerSide },
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
