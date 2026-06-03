import { Phase } from '@prisma/client';

export type ExternalFixture = {
  externalId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  externalStatus: string;
  round: string;
  phase: Phase | null;
};

export type FixtureImportResult = {
  importedMatches: number;
  createdMatches: number;
  updatedMatches: number;
  skippedUnknownPhase: number;
  skippedManualOverride: number;
  discoveredTeams: number;
  error?: 'missing_api_key';
};

export type PollingStatus = {
  enabled: boolean;
  frequencyMinutes: number;
  maxRequestsPerDay: number;
  requestsUsedToday: number;
  lastPollAt: string | null;
  lastPollResult: string | null;
  activeMatches: number;
};
