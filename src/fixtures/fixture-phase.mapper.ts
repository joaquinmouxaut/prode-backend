import { Phase } from '@prisma/client';

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function mapExternalRoundToPhase(round: string): Phase | null {
  const value = normalize(round);

  if (value.includes('group') || value.includes('grupos')) {
    if (
      value.includes('matchday 1') ||
      value.includes('jornada 1') ||
      value.endsWith(' - 1')
    ) {
      return Phase.GROUPS_1;
    }
    if (
      value.includes('matchday 2') ||
      value.includes('jornada 2') ||
      value.endsWith(' - 2')
    ) {
      return Phase.GROUPS_2;
    }
    if (
      value.includes('matchday 3') ||
      value.includes('jornada 3') ||
      value.endsWith(' - 3')
    ) {
      return Phase.GROUPS_3;
    }
  }

  if (value.includes('round of 16') || value.includes('octavos')) {
    return Phase.ROUND_OF_16;
  }
  // The 2026 format introduces round of 32. Until the domain model adds it,
  // we bucket it into the first knockout phase for scoring parity.
  if (value.includes('round of 32') || value.includes('last 32')) {
    return Phase.ROUND_OF_16;
  }
  if (value.includes('quarter') || value.includes('cuartos')) {
    return Phase.QUARTER_FINAL;
  }
  if (value.includes('semi') || value.includes('semifinal')) {
    return Phase.SEMI_FINAL;
  }
  if (
    value.includes('third') ||
    value.includes('3rd') ||
    value.includes('tercer')
  ) {
    return Phase.THIRD_PLACE;
  }
  if (value === 'final' || value.endsWith(' final')) {
    return Phase.FINAL;
  }

  return null;
}

export function mapExternalCompetitionStageToPhase(
  stage: string | null | undefined,
  matchday: number | null | undefined,
): Phase | null {
  const normalizedStage = normalize(stage ?? '');

  if (normalizedStage === 'group_stage') {
    if (matchday === 1) {
      return Phase.GROUPS_1;
    }
    if (matchday === 2) {
      return Phase.GROUPS_2;
    }
    if (matchday === 3) {
      return Phase.GROUPS_3;
    }
    return null;
  }

  if (normalizedStage === 'last_16') {
    return Phase.ROUND_OF_16;
  }
  if (normalizedStage === 'last_32') {
    return Phase.ROUND_OF_16;
  }
  if (normalizedStage === 'quarter_finals') {
    return Phase.QUARTER_FINAL;
  }
  if (normalizedStage === 'semi_finals') {
    return Phase.SEMI_FINAL;
  }
  if (normalizedStage === 'third_place') {
    return Phase.THIRD_PLACE;
  }
  if (normalizedStage === 'final') {
    return Phase.FINAL;
  }

  return mapExternalRoundToPhase(stage ?? '');
}
