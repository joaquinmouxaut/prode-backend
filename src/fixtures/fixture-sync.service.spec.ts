import { FixtureSyncService } from './fixture-sync.service';

function createFixtureSyncDeps() {
  return {
    prisma: {
      match: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    },
    apiFootballClient: {
      isConfigured: jest.fn(),
      fetchWorldCupFixtures: jest.fn(),
      fetchMatchByExternalId: jest.fn(),
    },
    recalcService: {
      applyExternalResult: jest.fn(),
    },
  };
}

describe('FixtureSyncService', () => {
  afterEach(() => {
    delete process.env.FIXTURE_POLL_ENABLED;
    delete process.env.FOOTBALL_API_MAX_REQUESTS_PER_DAY;
  });

  it('reports polling disabled when API key is missing', async () => {
    const deps = createFixtureSyncDeps();
    deps.apiFootballClient.isConfigured.mockReturnValue(false);
    deps.prisma.match.findMany.mockResolvedValue([]);

    const service = new FixtureSyncService(
      deps.prisma as never,
      deps.apiFootballClient as never,
      deps.recalcService as never,
    );

    service.onModuleInit();
    const status = await service.getPollingStatus();

    expect(status.enabled).toBe(false);
    expect(status.lastPollResult).toBe('missing_api_key');
  });

  it('returns missing_api_key when import is called without API token', async () => {
    const deps = createFixtureSyncDeps();
    deps.apiFootballClient.isConfigured.mockReturnValue(false);

    const service = new FixtureSyncService(
      deps.prisma as never,
      deps.apiFootballClient as never,
      deps.recalcService as never,
    );

    const result = await service.importFixture();

    expect(result).toEqual({
      importedMatches: 0,
      createdMatches: 0,
      updatedMatches: 0,
      skippedUnknownPhase: 0,
      skippedManualOverride: 0,
      discoveredTeams: 0,
      error: 'missing_api_key',
    });
    expect(deps.apiFootballClient.fetchWorldCupFixtures).not.toHaveBeenCalled();
  });

  it('skips scheduled sync when there are no active matches', async () => {
    const deps = createFixtureSyncDeps();
    deps.apiFootballClient.isConfigured.mockReturnValue(true);
    deps.prisma.match.findMany.mockResolvedValue([]);
    process.env.FIXTURE_POLL_ENABLED = 'true';

    const service = new FixtureSyncService(
      deps.prisma as never,
      deps.apiFootballClient as never,
      deps.recalcService as never,
    );

    const result = await service.runManualSync();

    expect(result).toEqual({
      trigger: 'manual',
      skipped: 'no_active_match_window',
      syncedMatches: 0,
    });
    expect(
      deps.apiFootballClient.fetchMatchByExternalId,
    ).not.toHaveBeenCalled();
  });

  it('syncs active matches individually from football-data', async () => {
    const deps = createFixtureSyncDeps();
    deps.apiFootballClient.isConfigured.mockReturnValue(true);
    deps.prisma.match.findMany.mockResolvedValue([
      {
        externalId: '537327',
        externalStatus: 'IN_PLAY',
        homeGoals: 1,
        awayGoals: 0,
      },
    ]);
    deps.apiFootballClient.fetchMatchByExternalId.mockResolvedValue({
      externalId: '537327',
      date: '2026-06-11T19:00:00Z',
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      homeGoals: 1,
      awayGoals: 0,
      externalStatus: 'IN_PLAY',
      round: 'GROUP_STAGE',
      phase: 'GROUPS_1',
    });
    deps.recalcService.applyExternalResult.mockResolvedValue({
      matched: true,
      matchId: 1,
      recalculatedPredictions: 3,
      recalculatedUsers: 3,
    });
    process.env.FIXTURE_POLL_ENABLED = 'true';

    const service = new FixtureSyncService(
      deps.prisma as never,
      deps.apiFootballClient as never,
      deps.recalcService as never,
    );

    const result = await service.runManualSync();

    expect(result).toEqual({
      trigger: 'manual',
      candidates: 1,
      syncedMatches: 1,
      scoreChanges: 1,
      skippedByFinalized: 0,
      details: [
        {
          externalId: '537327',
          matched: true,
          skipped: undefined,
          apiStatus: 'IN_PLAY',
          apiScore: '1:0',
        },
      ],
    });
    expect(deps.apiFootballClient.fetchMatchByExternalId).toHaveBeenCalledWith(
      '537327',
    );
  });
});
