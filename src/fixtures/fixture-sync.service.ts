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

const LIVE_STATUSES = new Set([
  '1H',
  'HT',
  '2H',
  'ET',
  'P',
  'BT',
  'SUSP',
  'INT',
]);
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

type ImportExistingMatch = {
  id: number;
  manualOverride: boolean;
};

type ActiveCandidateMatch = {
  externalStatus: string | null;
};

type MatchResultSource = 'ADMIN' | 'API' | 'IMPORT';

interface FixtureMatchModel {
  findUnique(args: {
    where: { externalId: string };
    select: { id: true; manualOverride: true };
  }): Promise<ImportExistingMatch | null>;
  create(args: {
    data: {
      externalId: string;
      homeTeam: string;
      awayTeam: string;
      date: Date;
      phase: Phase;
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
      manualOverride: false;
      date: { lte: Date; gte: Date };
    };
    select: { externalStatus: true };
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
    const matchModel = this.getMatchModel();
    const fixtures = await this.apiFootballClient.fetchWorldCupFixtures();
    const teamNames = new Set<string>();
    let createdMatches = 0;
    let updatedMatches = 0;
    let skippedUnknownPhase = 0;
    let skippedManualOverride = 0;

    for (const fixture of fixtures) {
      teamNames.add(fixture.homeTeam);
      teamNames.add(fixture.awayTeam);

      if (!fixture.phase) {
        skippedUnknownPhase += 1;
        continue;
      }

      const existing = await matchModel.findUnique({
        where: { externalId: fixture.externalId },
        select: { id: true, manualOverride: true },
      });

      const baseData = {
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        date: new Date(fixture.date),
        phase: fixture.phase,
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

      if (existing.manualOverride) {
        skippedManualOverride += 1;
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
      importedMatches: createdMatches + updatedMatches,
      createdMatches,
      updatedMatches,
      skippedUnknownPhase,
      skippedManualOverride,
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

    const activeMatches = await this.countPotentiallyActiveMatches();
    if (activeMatches === 0) {
      this.lastPollResult = 'no_active_match_window';
      return { trigger, skipped: 'no_active_match_window', syncedMatches: 0 };
    }

    this.requestsUsedToday += 1;
    this.lastPollAt = new Date();

    try {
      const fixtures =
        await this.apiFootballClient.fetchWorldCupActiveAndRecentlyFinishedFixtures();
      let syncedMatches = 0;
      let scoreChanges = 0;
      let skippedByOverride = 0;

      for (const fixture of fixtures) {
        const sync = await this.recalcService.applyExternalResult({
          externalId: fixture.externalId,
          homeGoals: fixture.homeGoals,
          awayGoals: fixture.awayGoals,
          externalStatus: fixture.externalStatus,
          syncedAt: this.lastPollAt,
        });

        if (!sync.matched) {
          continue;
        }

        syncedMatches += 1;
        if ('skipped' in sync && sync.skipped === 'manual_override') {
          skippedByOverride += 1;
        }
        if (
          'recalculatedPredictions' in sync &&
          sync.recalculatedPredictions > 0
        ) {
          scoreChanges += 1;
        }
      }

      this.lastPollResult = `ok:synced=${syncedMatches},score_changes=${scoreChanges},override_skips=${skippedByOverride}`;
      return { trigger, syncedMatches, scoreChanges, skippedByOverride };
    } catch (error) {
      this.lastPollResult = 'error';
      this.logger.error(
        'Live sync failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async countPotentiallyActiveMatches(): Promise<number> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - ACTIVE_WINDOW_MS);
    const matchModel = this.getMatchModel();
    const candidates = await matchModel.findMany({
      where: {
        externalId: { not: null },
        manualOverride: false,
        date: { lte: now, gte: windowStart },
      },
      select: { externalStatus: true },
    });

    return candidates.filter((match: ActiveCandidateMatch) => {
      if (!match.externalStatus) {
        return true;
      }
      if (LIVE_STATUSES.has(match.externalStatus)) {
        return true;
      }
      return !FINAL_STATUSES.has(match.externalStatus);
    }).length;
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
