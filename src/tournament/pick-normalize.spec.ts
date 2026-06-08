import { normalizePick, picksMatch } from './pick-normalize';

describe('pick-normalize', () => {
  it('matches picks ignoring case and accents', () => {
    expect(picksMatch('Argentina', 'argentina')).toBe(true);
    expect(picksMatch('Lionel Messi', 'lionel messi')).toBe(true);
  });

  it('rejects empty or missing values', () => {
    expect(picksMatch('', 'Argentina')).toBe(false);
    expect(picksMatch('Argentina', null)).toBe(false);
  });

  it('normalizes extra whitespace', () => {
    expect(normalizePick('  Lionel   Messi  ')).toBe('lionel messi');
  });
});
