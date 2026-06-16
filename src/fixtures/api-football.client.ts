import { Injectable, Logger } from '@nestjs/common';
import { normalizeFootballDataGroupCode } from '../matches/match-group-code';
import { mapExternalCompetitionStageToPhase } from './fixture-phase.mapper';
import type { ExternalFixture } from './types';

type FootballDataMatchItem = {
  id?: number;
  utcDate?: string;
  status?: string;
  stage?: string;
  matchday?: number | null;
  group?: string | null;
  homeTeam?: {
    name?: string;
  };
  awayTeam?: {
    name?: string;
  };
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    regularTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

type FootballDataApiResponse = {
  error?: string;
  message?: string;
  errorCode?: number;
  id?: number;
  matches?: FootballDataMatchItem[];
};

const DEFAULT_BASE_URL = 'https://api.football-data.org/v4';
const DEFAULT_WORLD_CUP_COMPETITION_CODE = 'WC';
const DEFAULT_WORLD_CUP_SEASON = 2026;
const SYNC_CANDIDATE_STATUSES = new Set([
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'AWARDED',
  'SUSPENDED',
  'POSTPONED',
  'CANCELLED',
]);

@Injectable()
export class ApiFootballClient {
  private readonly logger = new Logger(ApiFootballClient.name);
  private readonly apiKey = process.env.FOOTBALL_DATA_API_TOKEN?.trim();
  private readonly baseUrl =
    process.env.FOOTBALL_DATA_BASE_URL?.trim() ?? DEFAULT_BASE_URL;
  private readonly competitionCode =
    process.env.FOOTBALL_DATA_COMPETITION_CODE?.trim() ??
    DEFAULT_WORLD_CUP_COMPETITION_CODE;
  private readonly season = this.readNumericEnv(
    'FOOTBALL_DATA_SEASON',
    DEFAULT_WORLD_CUP_SEASON,
  );

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchWorldCupFixtures(): Promise<ExternalFixture[]> {
    const data = await this.request(this.matchesPath());
    return this.toExternalFixtures(data);
  }

  async fetchWorldCupActiveAndRecentlyFinishedFixtures(): Promise<
    ExternalFixture[]
  > {
    const data = await this.request(this.matchesPath());
    const filtered = (data.matches ?? []).filter((match) =>
      SYNC_CANDIDATE_STATUSES.has((match.status ?? '').toUpperCase()),
    );
    return this.toExternalFixtures({ ...data, matches: filtered });
  }

  async fetchMatchByExternalId(
    externalId: string,
  ): Promise<ExternalFixture | null> {
    const match = await this.requestMatch(`/matches/${externalId}`);
    if (!match) {
      return null;
    }

    return this.toExternalFixture(match);
  }

  private extractGoals(item: FootballDataMatchItem): {
    homeGoals: number | null;
    awayGoals: number | null;
  } {
    const fullTime = item.score?.fullTime;
    if (fullTime?.home !== null && fullTime?.home !== undefined) {
      if (fullTime?.away !== null && fullTime?.away !== undefined) {
        return { homeGoals: fullTime.home, awayGoals: fullTime.away };
      }
    }

    const regularTime = item.score?.regularTime;
    if (
      regularTime?.home !== null &&
      regularTime?.home !== undefined &&
      regularTime?.away !== null &&
      regularTime?.away !== undefined
    ) {
      return { homeGoals: regularTime.home, awayGoals: regularTime.away };
    }

    return { homeGoals: null, awayGoals: null };
  }

  private toExternalFixture(item: FootballDataMatchItem): ExternalFixture | null {
    const fixtureId = item.id;
    const date = item.utcDate;
    const homeTeam = item.homeTeam?.name;
    const awayTeam = item.awayTeam?.name;
    const stage = item.stage ?? '';
    if (!fixtureId || !date || !homeTeam || !awayTeam) {
      return null;
    }

    const { homeGoals, awayGoals } = this.extractGoals(item);

    return {
      externalId: String(fixtureId),
      date,
      homeTeam,
      awayTeam,
      homeGoals,
      awayGoals,
      externalStatus: item.status ?? 'UNKNOWN',
      round: stage,
      phase: mapExternalCompetitionStageToPhase(stage, item.matchday),
      groupCode: normalizeFootballDataGroupCode(item.group),
    };
  }

  private toExternalFixtures(data: FootballDataApiResponse): ExternalFixture[] {
    const fixtures = data.matches ?? [];
    return fixtures
      .map((item) => this.toExternalFixture(item))
      .filter((fixture): fixture is ExternalFixture => fixture !== null);
  }

  private async request(path: string): Promise<FootballDataApiResponse> {
    if (!this.apiKey) {
      throw new Error('Missing FOOTBALL_DATA_API_TOKEN env var');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'X-Auth-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `football-data request failed: ${response.status} ${body}`,
      );
      throw new Error(
        `football-data request failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as FootballDataApiResponse;
    if (data.errorCode !== undefined || (data.message && !data.matches)) {
      const details = [data.error, data.message].filter(Boolean).join('; ');
      this.logger.error(`football-data returned errors: ${details}`);
      throw new Error(`football-data returned errors: ${details}`);
    }

    return data;
  }

  private async requestMatch(path: string): Promise<FootballDataMatchItem | null> {
    const data = await this.request(path);
    if (data.id) {
      return data as FootballDataMatchItem;
    }

    return null;
  }

  private matchesPath(): string {
    return `/competitions/${this.competitionCode}/matches?season=${this.season}`;
  }

  private readNumericEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    this.logger.warn(
      `Invalid ${name} value "${raw}". Falling back to ${fallback}.`,
    );
    return fallback;
  }
}
