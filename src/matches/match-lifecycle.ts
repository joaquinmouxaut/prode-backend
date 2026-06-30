const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED']);
const API_FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED']);
const STARTED_STATUSES = new Set([
  'IN_PLAY',
  'PAUSED',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
  'FINISHED',
  'AWARDED',
  'SUSPENDED',
  'CANCELLED',
]);

export type MatchLifecycleInput = {
  date?: Date | string;
  externalStatus?: string | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  finalizedAt?: Date | string | null;
};

export function isMatchFinalized(match: MatchLifecycleInput): boolean {
  return match.finalizedAt != null;
}

export function isMatchStarted(
  match: MatchLifecycleInput,
  now = new Date(),
): boolean {
  const status = match.externalStatus?.toUpperCase();
  if (status) {
    if (LIVE_STATUSES.has(status) || STARTED_STATUSES.has(status)) {
      return true;
    }
    if (status === 'TIMED' || status === 'SCHEDULED') {
      return (
        match.date != null && new Date(match.date).getTime() <= now.getTime()
      );
    }
  }

  return match.date != null && new Date(match.date).getTime() <= now.getTime();
}

/** Partido cerrado manualmente por admin: no admite más cambios de resultado. */
export function isMatchFinished(match: MatchLifecycleInput): boolean {
  return isMatchFinalized(match);
}

/** Partido finalizado según el estado reportado por la API externa. */
export function isMatchApiFinished(match: MatchLifecycleInput): boolean {
  const status = match.externalStatus?.toUpperCase();
  return status != null && API_FINISHED_STATUSES.has(status);
}

export function isMatchInProgress(
  match: MatchLifecycleInput,
  now = new Date(),
): boolean {
  if (isMatchFinalized(match)) {
    return false;
  }

  const status = match.externalStatus?.toUpperCase();
  if (status && LIVE_STATUSES.has(status)) {
    return true;
  }

  if (status === 'FINISHED' || status === 'AWARDED' || status === 'CANCELLED') {
    return false;
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
