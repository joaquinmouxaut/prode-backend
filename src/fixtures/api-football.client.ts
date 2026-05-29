import { Injectable, Logger } from '@nestjs/common';
import { mapExternalRoundToPhase } from './fixture-phase.mapper';
import type { ExternalFixture } from './types';

type ApiFootballFixtureItem = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
    };
  };
  league?: {
    round?: string;
  };
  teams?: {
    home?: { name?: string };
    away?: { name?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

type ApiFootballResponse = {
  response?: ApiFootballFixtureItem[];
};

const DEFAULT_BASE_URL = 'https://v3.football.api-sports.io';
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const ACTIVE_STATUS_FILTER = '1H-HT-2H-ET-P-BT-SUSP-INT';
const FINAL_STATUS_FILTER = 'FT-AET-PEN';

@Injectable()
export class ApiFootballClient {
  private readonly logger = new Logger(ApiFootballClient.name);
  private readonly apiKey = process.env.FOOTBALL_API_KEY?.trim();
  private readonly baseUrl =
    process.env.FOOTBALL_API_BASE_URL?.trim() ?? DEFAULT_BASE_URL;

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchWorldCupFixtures(): Promise<ExternalFixture[]> {
    const data = await this.request(
      `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}`,
    );
    return this.toExternalFixtures(data);
  }

  async fetchWorldCupActiveAndRecentlyFinishedFixtures(): Promise<
    ExternalFixture[]
  > {
    const data = await this.request(
      `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&status=${ACTIVE_STATUS_FILTER}-${FINAL_STATUS_FILTER}`,
    );
    return this.toExternalFixtures(data);
  }

  private async request(path: string): Promise<ApiFootballResponse> {
    if (!this.apiKey) {
      throw new Error('Missing FOOTBALL_API_KEY env var');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'x-apisports-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `API-Football request failed: ${response.status} ${body}`,
      );
      throw new Error(
        `API-Football request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as ApiFootballResponse;
  }

  private toExternalFixtures(data: ApiFootballResponse): ExternalFixture[] {
    const fixtures = data.response ?? [];
    return fixtures
      .map((item) => {
        const fixtureId = item.fixture?.id;
        const date = item.fixture?.date;
        const homeTeam = item.teams?.home?.name;
        const awayTeam = item.teams?.away?.name;
        const round = item.league?.round ?? '';
        if (!fixtureId || !date || !homeTeam || !awayTeam) {
          return null;
        }

        return {
          externalId: String(fixtureId),
          date,
          homeTeam,
          awayTeam,
          homeGoals: item.goals?.home ?? null,
          awayGoals: item.goals?.away ?? null,
          externalStatus: item.fixture?.status?.short ?? 'UNK',
          round,
          phase: mapExternalRoundToPhase(round),
        } satisfies ExternalFixture;
      })
      .filter((fixture): fixture is ExternalFixture => fixture !== null);
  }
}
