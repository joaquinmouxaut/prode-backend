import { MatchDecision, TeamSide } from '@prisma/client';
import { ApiFootballClient } from './api-football.client';

type FetchMock = jest.Mock<Promise<unknown>, [string, unknown]>;

function mockFetchOnce(body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as FetchMock;
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('ApiFootballClient — score parsing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.FOOTBALL_DATA_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function buildClient() {
    return new ApiFootballClient();
  }

  it('stores the on-pitch draw (not the shootout) for a penalty match', async () => {
    // Holanda 1-1 Marruecos; avanza Marruecos (visitante) por penales 2-4.
    // football-data devuelve fullTime con los penales sumados (3-5).
    mockFetchOnce({
      id: 999,
      utcDate: '2026-07-05T18:00:00Z',
      status: 'FINISHED',
      stage: 'LAST_16',
      homeTeam: { name: 'Netherlands' },
      awayTeam: { name: 'Morocco' },
      score: {
        winner: 'AWAY_TEAM',
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 3, away: 5 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 2, away: 4 },
      },
    });

    const fixture = await buildClient().fetchMatchByExternalId('999');

    expect(fixture).not.toBeNull();
    expect(fixture?.homeGoals).toBe(1);
    expect(fixture?.awayGoals).toBe(1);
    expect(fixture?.winnerSide).toBe(TeamSide.AWAY);
    expect(fixture?.decidedBy).toBe(MatchDecision.PENALTIES);
  });

  it('keeps regulation + extra time goals when a shootout follows extra-time goals', async () => {
    // 2-2 a los 90', 3-3 en la prórroga, y luego penales.
    mockFetchOnce({
      id: 1000,
      utcDate: '2026-07-06T18:00:00Z',
      status: 'FINISHED',
      stage: 'QUARTER_FINALS',
      homeTeam: { name: 'Argentina' },
      awayTeam: { name: 'France' },
      score: {
        winner: 'HOME_TEAM',
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 7, away: 6 },
        regularTime: { home: 2, away: 2 },
        extraTime: { home: 1, away: 1 },
        penalties: { home: 4, away: 3 },
      },
    });

    const fixture = await buildClient().fetchMatchByExternalId('1000');

    expect(fixture?.homeGoals).toBe(3);
    expect(fixture?.awayGoals).toBe(3);
    expect(fixture?.winnerSide).toBe(TeamSide.HOME);
    expect(fixture?.decidedBy).toBe(MatchDecision.PENALTIES);
  });

  it('falls back to fullTime - penalties when regularTime is missing', async () => {
    mockFetchOnce({
      id: 1001,
      utcDate: '2026-07-07T18:00:00Z',
      status: 'FINISHED',
      stage: 'LAST_16',
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Spain' },
      score: {
        winner: 'HOME_TEAM',
        duration: 'PENALTY_SHOOTOUT',
        fullTime: { home: 5, away: 4 },
        penalties: { home: 4, away: 3 },
      },
    });

    const fixture = await buildClient().fetchMatchByExternalId('1001');

    expect(fixture?.homeGoals).toBe(1);
    expect(fixture?.awayGoals).toBe(1);
  });

  it('uses fullTime directly for matches decided in extra time (no shootout)', async () => {
    mockFetchOnce({
      id: 1002,
      utcDate: '2026-07-08T18:00:00Z',
      status: 'FINISHED',
      stage: 'SEMI_FINALS',
      homeTeam: { name: 'Portugal' },
      awayTeam: { name: 'Germany' },
      score: {
        winner: 'HOME_TEAM',
        duration: 'EXTRA_TIME',
        fullTime: { home: 2, away: 1 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 1, away: 0 },
      },
    });

    const fixture = await buildClient().fetchMatchByExternalId('1002');

    expect(fixture?.homeGoals).toBe(2);
    expect(fixture?.awayGoals).toBe(1);
    expect(fixture?.winnerSide).toBe(TeamSide.HOME);
    expect(fixture?.decidedBy).toBe(MatchDecision.EXTRA_TIME);
  });

  it('uses fullTime for a regular-time result', async () => {
    mockFetchOnce({
      id: 1003,
      utcDate: '2026-06-15T18:00:00Z',
      status: 'FINISHED',
      stage: 'GROUP_STAGE',
      matchday: 1,
      group: 'Group A',
      homeTeam: { name: 'Mexico' },
      awayTeam: { name: 'Canada' },
      score: {
        winner: 'HOME_TEAM',
        duration: 'REGULAR',
        fullTime: { home: 2, away: 0 },
        regularTime: { home: 2, away: 0 },
      },
    });

    const fixture = await buildClient().fetchMatchByExternalId('1003');

    expect(fixture?.homeGoals).toBe(2);
    expect(fixture?.awayGoals).toBe(0);
    expect(fixture?.decidedBy).toBe(MatchDecision.REGULAR);
  });
});
