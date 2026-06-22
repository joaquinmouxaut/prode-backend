import { Phase, TeamSide } from '@prisma/client';

const GROUP_PHASES: ReadonlySet<Phase> = new Set([
  Phase.GROUPS_1,
  Phase.GROUPS_2,
  Phase.GROUPS_3,
]);

/** True para fases de eliminatoria (mata-mata), donde no puede haber empate. */
export function isKnockoutPhase(phase: Phase): boolean {
  return !GROUP_PHASES.has(phase);
}

/**
 * Deriva qué lado avanza a partir de un marcador decisivo.
 * Devuelve null cuando el marcador es empate (se necesita el ganador explícito).
 */
export function deriveAdvancingTeam(
  homeGoals: number,
  awayGoals: number,
): TeamSide | null {
  if (homeGoals > awayGoals) {
    return TeamSide.HOME;
  }
  if (awayGoals > homeGoals) {
    return TeamSide.AWAY;
  }
  return null;
}
