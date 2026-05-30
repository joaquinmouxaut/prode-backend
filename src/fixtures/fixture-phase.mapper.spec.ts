import { Phase } from '@prisma/client';
import {
  mapExternalCompetitionStageToPhase,
  mapExternalRoundToPhase,
} from './fixture-phase.mapper';

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
    ['Round of 32', Phase.ROUND_OF_16],
  ])('maps "%s" to %s', (round, expected) => {
    expect(mapExternalRoundToPhase(round)).toBe(expected);
  });
});

describe('mapExternalCompetitionStageToPhase', () => {
  it.each<[string, number | null, Phase | null]>([
    ['GROUP_STAGE', 1, Phase.GROUPS_1],
    ['GROUP_STAGE', 2, Phase.GROUPS_2],
    ['GROUP_STAGE', 3, Phase.GROUPS_3],
    ['LAST_16', null, Phase.ROUND_OF_16],
    ['QUARTER_FINALS', null, Phase.QUARTER_FINAL],
    ['SEMI_FINALS', null, Phase.SEMI_FINAL],
    ['THIRD_PLACE', null, Phase.THIRD_PLACE],
    ['FINAL', null, Phase.FINAL],
    ['LAST_32', null, Phase.ROUND_OF_16],
  ])('maps stage "%s" (matchday %s) to %s', (stage, matchday, expected) => {
    expect(mapExternalCompetitionStageToPhase(stage, matchday)).toBe(expected);
  });
});
