import { normalizeFootballDataGroupCode } from './match-group-code';

describe('normalizeFootballDataGroupCode', () => {
  it('accepts football-data GROUP_* codes', () => {
    expect(normalizeFootballDataGroupCode('GROUP_F')).toBe('GROUP_F');
    expect(normalizeFootballDataGroupCode('group_a')).toBe('GROUP_A');
  });

  it('normalizes single-letter codes', () => {
    expect(normalizeFootballDataGroupCode('H')).toBe('GROUP_H');
  });

  it('returns null for empty or unknown values', () => {
    expect(normalizeFootballDataGroupCode(null)).toBeNull();
    expect(normalizeFootballDataGroupCode('')).toBeNull();
    expect(normalizeFootballDataGroupCode('ROUND_1')).toBeNull();
  });
});
