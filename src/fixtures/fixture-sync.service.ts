import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Phase } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultRecalculationService } from '../results/result-recalculation.service';
import { ApiFootballClient } from './api-football.client';
import type { FixtureImportResult, PollingStatus } from './types';

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED']);
const FINAL_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED']);
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

type ImportExistingMatch = {
  id: number;
  finalizedAt: Date | null;
  groupCode: string | null;
};

type ActiveCandidateMatch = {
  externalId: string;
  externalStatus: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
};

type MatchResultSource = 'ADMIN' | 'API' | 'IMPORT';

interface FixtureMatchModel {
  findUnique(args: {
    where: { externalId: string };
    select: { id: true; finalizedAt: true; groupCode: true };
  }): Promise<ImportExistingMatch | null>;
  create(args: {
    data: {
      externalId: string;
      homeTeam: string;
      awayTeam: string;
      date: Date;
      phase: Phase;
      groupCode: string | null;
      externalStatus: string;
      resultSource: MatchResultSource;
      lastSyncedAt: Date;
      homeGoals: number | null;
      awayGoals: number | null;
      manualOverride: boolean;
    };
  }): Promise<unknown>;
  update(args: {
    where: { id: number };
    data: {
      homeTeam?: string;
      awayTeam?: string;
      date?: Date;
      phase?: Phase;
      groupCode?: string | null;
      externalStatus?: string;
      resultSource?: MatchResultSource;
      lastSyncedAt?: Date;
      homeGoals?: number | null;
      awayGoals?: number | null;
    };
  }): Promise<unknown>;
  findMany(args: {
    where: {
      externalId: { not: null };
      date: { lte: Date; gte: Date };
      finalizedAt: null;
    };
    select: {
      externalId: true;
      externalStatus: true;
      homeGoals: true;
      awayGoals: true;
    };
  }): Promise<ActiveCandidateMatch[]>;
}

@Injectable()
export class FixtureSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FixtureSyncService.name);
  private interval: NodeJS.Timeout | null = null;
  private readonly frequencyMinutes = Number(
    process.env.FIXTURE_POLL_MINUTES ?? '15',
  );
  private readonly maxRequestsPerDay = Number(
    process.env.FOOTBALL_API_MAX_REQUESTS_PER_DAY ?? '80',
  );
  private readonly tickerSeconds = Number(
    process.env.FIXTURE_POLL_TICKER_SECONDS ?? '60',
  );
  private readonly pollingEnabled =
    process.env.FIXTURE_POLL_ENABLED !== 'false';

  private requestsUsedToday = 0;
  private requestsDayKey = this.currentDayKey();
  private lastPollAt: Date | null = null;
  private lastPollResult: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiFootballClient: ApiFootballClient,
    private readonly recalcService: ResultRecalculationService,
  ) {}

  onModuleInit() {
    if (!this.pollingEnabled || !this.apiFootballClient.isConfigured()) {
      this.lastPollResult = this.apiFootballClient.isConfigured()
        ? 'polling_disabled'
        : 'missing_api_key';
      return;
    }

    this.interval = setInterval(() => {
      void this.runScheduledSync();
    }, this.tickerSeconds * 1000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private getMatchModel(): FixtureMatchModel {
    return this.prisma.match as unknown as FixtureMatchModel;
  }

  async importFixture(): Promise<FixtureImportResult> {
    if (!this.apiFootballClient.isConfigured()) {
      return {
        importedMatches: 0,
        createdMatches: 0,
        updatedMatches: 0,
        backfilledGroupCodes: 0,
        skippedUnknownPhase: 0,
        skippedManualOverride: 0,
        discoveredTeams: 0,
        error: 'missing_api_key',
      };
    }

    const matchModel = this.getMatchModel();
    const fixtures = await this.apiFootballClient.fetchWorldCupFixtures();
    const teamNames = new Set<string>();
    let createdMatches = 0;
    let updatedMatches = 0;
    let backfilledGroupCodes = 0;
    let skippedUnknownPhase = 0;

    for (const fixture of fixtures) {
      teamNames.add(fixture.homeTeam);
      teamNames.add(fixture.awayTeam);

      if (!fixture.phase) {
        skippedUnknownPhase += 1;
        continue;
      }

      const existing = await matchModel.findUnique({
        where: { externalId: fixture.externalId },
        select: { id: true, finalizedAt: true, groupCode: true },
      });

      const baseData = {
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        date: new Date(fixture.date),
        phase: fixture.phase,
        groupCode: fixture.groupCode,
        externalStatus: fixture.externalStatus,
        resultSource: 'IMPORT' as const,
        lastSyncedAt: new Date(),
      };

      if (!existing) {
        await matchModel.create({
          data: {
            ...baseData,
            externalId: fixture.externalId,
            homeGoals: fixture.homeGoals,
            awayGoals: fixture.awayGoals,
            manualOverride: false,
          },
        });
        createdMatches += 1;
        continue;
      }

      if (existing.finalizedAt) {
        if (fixture.groupCode && !existing.groupCode) {
          await matchModel.update({
            where: { id: existing.id },
            data: { groupCode: fixture.groupCode },
          });
          backfilledGroupCodes += 1;
        }
        continue;
      }

      await matchModel.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          homeGoals: fixture.homeGoals,
          awayGoals: fixture.awayGoals,
        },
      });
      updatedMatches += 1;
    }

    return {
      importedMatches: createdMatches + updatedMatches + backfilledGroupCodes,
      createdMatches,
      updatedMatches,
      backfilledGroupCodes,
      skippedUnknownPhase,
      skippedManualOverride: 0,
      discoveredTeams: teamNames.size,
    };
  }

  async getPollingStatus(): Promise<PollingStatus> {
    this.rotateDayIfNeeded();
    const activeMatches = await this.countPotentiallyActiveMatches();
    return {
      enabled: this.pollingEnabled && this.apiFootballClient.isConfigured(),
      frequencyMinutes: this.frequencyMinutes,
      maxRequestsPerDay: this.maxRequestsPerDay,
      requestsUsedToday: this.requestsUsedToday,
      lastPollAt: this.lastPollAt?.toISOString() ?? null,
      lastPollResult: this.lastPollResult,
      activeMatches,
    };
  }

  async runManualSync() {
    return this.syncNow('manual');
  }

  private async runScheduledSync() {
    await this.syncNow('scheduled');
  }

  private async syncNow(trigger: 'scheduled' | 'manual') {
    this.rotateDayIfNeeded();

    if (!this.pollingEnabled) {
      this.lastPollResult = 'polling_disabled';
      return { trigger, skipped: 'polling_disabled', syncedMatches: 0 };
    }
    if (!this.apiFootballClient.isConfigured()) {
      this.lastPollResult = 'missing_api_key';
      return { trigger, skipped: 'missing_api_key', syncedMatches: 0 };
    }
    if (this.requestsUsedToday >= this.maxRequestsPerDay) {
      this.lastPollResult = 'daily_budget_exhausted';
      return { trigger, skipped: 'daily_budget_exhausted', syncedMatches: 0 };
    }
    if (
      trigger === 'scheduled' &&
      this.lastPollAt &&
      Date.now() - this.lastPollAt.getTime() < this.frequencyMinutes * 60 * 1000
    ) {
      this.lastPollResult = 'waiting_next_window';
      return { trigger, skipped: 'waiting_next_window', syncedMatches: 0 };
    }

    const activeMatches = await this.listPotentiallyActiveMatches();
    if (activeMatches.length === 0) {
      this.lastPollResult = 'no_active_match_window';
      return { trigger, skipped: 'no_active_match_window', syncedMatches: 0 };
    }

    this.requestsUsedToday += 1;
    this.lastPollAt = new Date();

    try {
      let syncedMatches = 0;
      let scoreChanges = 0;
      let skippedByFinalized = 0;
      const details: Array<{
        externalId: string;
        matched: boolean;
        skipped?: string;
        apiStatus?: string;
        apiScore?: string;
      }> = [];

      for (const candidate of activeMatches) {
        const fixture = await this.apiFootballClient.fetchMatchByExternalId(
          candidate.externalId,
        );
        if (!fixture) {
          details.push({
            externalId: candidate.externalId,
            matched: false,
            skipped: 'api_not_found',
          });
          continue;
        }

        const sync = await this.recalcService.applyExternalResult({
          externalId: fixture.externalId,
          homeGoals: fixture.homeGoals,
          awayGoals: fixture.awayGoals,
          externalStatus: fixture.externalStatus,
          syncedAt: this.lastPollAt,
        });

        details.push({
          externalId: fixture.externalId,
          matched: sync.matched,
          skipped: 'skipped' in sync ? sync.skipped : undefined,
          apiStatus: fixture.externalStatus,
          apiScore: `${fixture.homeGoals ?? '—'}:${fixture.awayGoals ?? '—'}`,
        });

        if (!sync.matched) {
          continue;
        }

        syncedMatches += 1;
        if ('skipped' in sync && sync.skipped === 'match_finalized') {
          skippedByFinalized += 1;
        }
        if (
          'recalculatedPredictions' in sync &&
          sync.recalculatedPredictions > 0
        ) {
          scoreChanges += 1;
        }
      }

      this.lastPollResult = `ok:candidates=${activeMatches.length},synced=${syncedMatches},score_changes=${scoreChanges},finalized_skips=${skippedByFinalized}`;
      return {
        trigger,
        candidates: activeMatches.length,
        syncedMatches,
        scoreChanges,
        skippedByFinalized,
        details,
      };
    } catch (error) {
      this.lastPollResult = 'error';
      this.logger.error(
        'Live sync failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async listPotentiallyActiveMatches(): Promise<ActiveCandidateMatch[]> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - ACTIVE_WINDOW_MS);
    const matchModel = this.getMatchModel();
    const candidates = await matchModel.findMany({
      where: {
        externalId: { not: null },
        date: { lte: now, gte: windowStart },
        finalizedAt: null,
      },
      select: {
        externalId: true,
        externalStatus: true,
        homeGoals: true,
        awayGoals: true,
      },
    });

    return candidates.filter((match: ActiveCandidateMatch) => {
      if (match.homeGoals === null || match.awayGoals === null) {
        return true;
      }
      if (!match.externalStatus) {
        return true;
      }
      if (LIVE_STATUSES.has(match.externalStatus)) {
        return true;
      }
      return !FINAL_STATUSES.has(match.externalStatus);
    });
  }

  private async countPotentiallyActiveMatches(): Promise<number> {
    return (await this.listPotentiallyActiveMatches()).length;
  }

  private rotateDayIfNeeded() {
    const nowDay = this.currentDayKey();
    if (nowDay === this.requestsDayKey) {
      return;
    }
    this.requestsDayKey = nowDay;
    this.requestsUsedToday = 0;
  }

  private currentDayKey() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  }
}
