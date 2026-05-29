import { Phase } from '@prisma/client';
import { mapExternalRoundToPhase } from './fixture-phase.mapper';

describe('mapExternalRoundToPhase', () => {
  it.each<[string, Phase | null]>([
    ['Group Stage - 1', Phase.GROUPS_1],
    ['Group Stage - 2', Phase.GROUPS_2],
    ['Group Stage - 3', Phase.GROUPS_3],
    ['Round of 16', Phase.ROUND_OF_16],
    ['Quarter-finals', Phase.QUARTER_FINAL],
    ['Semi-finals', Phase.SEMI_FINAL],
    ['Third Place', Phase.THIRD_PLACE],
    ['Final', Phase.FINAL],
    ['Round of 32', null],
  ])('maps "%s" to %s', (round, expected) => {
    expect(mapExternalRoundToPhase(round)).toBe(expected);
  });
});
