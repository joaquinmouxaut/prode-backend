import { Phase } from '@prisma/client';
import { PointsService } from './points.service';

describe('PointsService', () => {
  let service: PointsService;

  beforeEach(() => {
    service = new PointsService();
  });

  describe('calculatePredictionPoints', () => {
    it.each<[Phase, number]>([
      [Phase.GROUPS_1, 12],
      [Phase.GROUPS_2, 12],
      [Phase.GROUPS_3, 12],
      [Phase.ROUND_OF_16, 24],
      [Phase.QUARTER_FINAL, 24],
      [Phase.SEMI_FINAL, 24],
      [Phase.THIRD_PLACE, 24],
      [Phase.FINAL, 36],
    ])('applies the phase multiplier for %s', (phase, expectedPoints) => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1, phase },
      );

      expect(points).toBe(expectedPoints);
    });

    it('returns zero when the match result is incomplete', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: null, awayGoals: 1, phase: Phase.FINAL },
      );

      expect(points).toBe(0);
    });
  });
});
