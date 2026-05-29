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
      fetchWorldCupActiveAndRecentlyFinishedFixtures: jest.fn(),
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
      deps.apiFootballClient.fetchWorldCupActiveAndRecentlyFinishedFixtures,
    ).not.toHaveBeenCalled();
  });
});
