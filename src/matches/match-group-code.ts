const GROUP_CODE_PATTERN = /^GROUP_([A-Z])$/i;

/** Normaliza el valor `group` de football-data.org (ej. GROUP_F). */
export function normalizeFootballDataGroupCode(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const upper = trimmed.toUpperCase();
  if (GROUP_CODE_PATTERN.test(upper)) {
    return upper;
  }

  if (/^[A-Z]$/.test(upper)) {
    return `GROUP_${upper}`;
  }

  return null;
}
