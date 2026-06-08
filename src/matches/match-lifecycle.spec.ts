import { hasScoreableResult, isMatchStarted } from './match-lifecycle';

describe('match-lifecycle', () => {
  const kickoff = new Date('2026-06-20T18:00:00.000Z');

  it('treats scheduled matches before kickoff as not started', () => {
    expect(
      isMatchStarted(
        {
          date: kickoff,
          externalStatus: 'SCHEDULED',
          homeGoals: 0,
          awayGoals: 0,
        },
        new Date('2026-06-20T17:59:00.000Z'),
      ),
    ).toBe(false);
  });

  it('treats live matches as started even before kickoff time', () => {
    expect(
      isMatchStarted(
        {
          date: kickoff,
          externalStatus: 'IN_PLAY',
          homeGoals: 0,
          awayGoals: 0,
        },
        new Date('2026-06-20T17:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('does not score matches that have not started', () => {
    expect(
      hasScoreableResult(
        {
          date: kickoff,
          externalStatus: 'SCHEDULED',
          homeGoals: 0,
          awayGoals: 0,
        },
        new Date('2026-06-20T17:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('scores started matches with a complete result', () => {
    expect(
      hasScoreableResult(
        {
          date: kickoff,
          externalStatus: 'IN_PLAY',
          homeGoals: 1,
          awayGoals: 0,
        },
        new Date('2026-06-20T18:05:00.000Z'),
      ),
    ).toBe(true);
  });
});
