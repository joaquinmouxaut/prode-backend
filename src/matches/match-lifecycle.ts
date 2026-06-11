const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED']);
const FINAL_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED']);
const STARTED_STATUSES = new Set([
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'AWARDED',
  'SUSPENDED',
  'CANCELLED',
]);

export type MatchLifecycleInput = {
  date: Date | string;
  externalStatus?: string | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
};

export function isMatchStarted(match: MatchLifecycleInput, now = new Date()): boolean {
  const status = match.externalStatus?.toUpperCase();
  if (status) {
    if (LIVE_STATUSES.has(status) || STARTED_STATUSES.has(status)) {
      return true;
    }
    if (status === 'TIMED' || status === 'SCHEDULED') {
      return new Date(match.date).getTime() <= now.getTime();
    }
  }

  return new Date(match.date).getTime() <= now.getTime();
}

export function isMatchFinished(match: MatchLifecycleInput): boolean {
  const status = match.externalStatus?.toUpperCase();
  if (status && FINAL_STATUSES.has(status)) {
    return true;
  }

  return false;
}

export function isMatchInProgress(
  match: MatchLifecycleInput,
  now = new Date(),
): boolean {
  if (isMatchFinished(match)) {
    return false;
  }

  const status = match.externalStatus?.toUpperCase();
  if (status && LIVE_STATUSES.has(status)) {
    return true;
  }

  return isMatchStarted(match, now);
}

export function hasScoreableResult(
  match: MatchLifecycleInput,
  now = new Date(),
): boolean {
  if (!isMatchStarted(match, now)) {
    return false;
  }

  return match.homeGoals !== null && match.awayGoals !== null;
}
