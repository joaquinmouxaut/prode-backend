export function normalizePick(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function picksMatch(
  pick: string | null | undefined,
  official: string | null | undefined,
): boolean {
  const normalizedPick = normalizePick(pick);
  const normalizedOfficial = normalizePick(official);

  return (
    normalizedPick.length > 0 &&
    normalizedOfficial.length > 0 &&
    normalizedPick === normalizedOfficial
  );
}
