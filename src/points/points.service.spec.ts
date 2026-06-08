import { Phase } from '@prisma/client';
import { PointsService } from './points.service';

describe('PointsService', () => {
  let service: PointsService;

  beforeEach(() => {
    service = new PointsService();
  });

  describe('calculatePredictionPoints', () => {
    it.each<[Phase, number]>([
      [Phase.GROUPS_1, 8],
      [Phase.GROUPS_2, 8],
      [Phase.GROUPS_3, 8],
      [Phase.ROUND_OF_16, 16],
      [Phase.QUARTER_FINAL, 16],
      [Phase.SEMI_FINAL, 16],
      [Phase.THIRD_PLACE, 16],
      [Phase.FINAL, 24],
    ])('applies the phase multiplier for an exact score in %s', (phase, expectedPoints) => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1, phase },
      );

      expect(points).toBe(expectedPoints);
    });

    it('awards 8 points for an exact score in groups', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(8);
    });

    it('awards 6 points for correct outcome and goal difference bonus', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 3, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 0, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(6);
    });

    it('awards 5 points for correct outcome and single-team bonus', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 0, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(5);
    });

    it('awards 4 points for correct outcome without any bonus', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 3, awayGoals: 0 },
        { homeGoals: 2, awayGoals: 1, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(4);
    });

    it('prefers exact bonus over goal-difference bonus', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 1 },
        { homeGoals: 1, awayGoals: 1, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(8);
    });

    it('prefers goal-difference bonus over single-team bonus', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 1 },
        { homeGoals: 0, awayGoals: 0, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(6);
    });

    it('returns zero when the outcome is wrong', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 0, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1, phase: Phase.GROUPS_1 },
      );

      expect(points).toBe(0);
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
