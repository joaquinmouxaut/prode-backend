import { Phase, TeamSide } from '@prisma/client';
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

  describe('calculatePredictionPoints — knockout (mata-mata)', () => {
    it('awards base points (no bonus) when predicting 2-0 but the tie ends 1-1 and the picked team advances', () => {
      // Ejemplo del usuario: predigo 2-0 de A, termina 1-1 y avanza A por penales.
      // 4 base, sin bonus, ×2 (octavos) = 8.
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 0, advancingTeam: TeamSide.HOME },
        {
          homeGoals: 1,
          awayGoals: 1,
          phase: Phase.ROUND_OF_16,
          winnerSide: TeamSide.HOME,
        },
      );

      expect(points).toBe(8);
    });

    it('awards base points when predicting a 1-1 draw with the right advancing team even if the real score is 2-0', () => {
      // Ejemplo inverso del usuario: predigo empate 1-1 y que avanza A; termina 2-0 A.
      // Acierto el que avanza: 4 base, sin bonus, ×2 = 8.
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 1, advancingTeam: TeamSide.HOME },
        {
          homeGoals: 2,
          awayGoals: 0,
          phase: Phase.ROUND_OF_16,
          winnerSide: TeamSide.HOME,
        },
      );

      expect(points).toBe(8);
    });

    it('returns zero when the picked advancing team is wrong (penalty winner mismatch)', () => {
      // Ejemplo del usuario: predigo empate y pongo A como ganador, pero avanza B.
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 1, advancingTeam: TeamSide.HOME },
        {
          homeGoals: 1,
          awayGoals: 1,
          phase: Phase.ROUND_OF_16,
          winnerSide: TeamSide.AWAY,
        },
      );

      expect(points).toBe(0);
    });

    it('adds the exact-score bonus when the advancing team and the score both match', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 1, advancingTeam: TeamSide.HOME },
        {
          homeGoals: 1,
          awayGoals: 1,
          phase: Phase.ROUND_OF_16,
          winnerSide: TeamSide.HOME,
        },
      );

      expect(points).toBe(16);
    });

    it('derives the advancing team from a decisive predicted score when none is provided', () => {
      // Predigo 3-1 (avance HOME implícito), real 2-0 HOME. Bonus diferencia de gol (+2). (4+2)×2 = 12.
      const points = service.calculatePredictionPoints(
        { homeGoals: 3, awayGoals: 1 },
        {
          homeGoals: 2,
          awayGoals: 0,
          phase: Phase.ROUND_OF_16,
          winnerSide: TeamSide.HOME,
        },
      );

      expect(points).toBe(12);
    });

    it('applies the Round of 32 multiplier (x2)', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 2, awayGoals: 1, advancingTeam: TeamSide.HOME },
        {
          homeGoals: 2,
          awayGoals: 1,
          phase: Phase.ROUND_OF_32,
          winnerSide: TeamSide.HOME,
        },
      );

      expect(points).toBe(16);
    });

    it('returns zero when the real match is a draw without a recorded winner', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 0, advancingTeam: TeamSide.HOME },
        {
          homeGoals: 1,
          awayGoals: 1,
          phase: Phase.ROUND_OF_16,
          winnerSide: null,
        },
      );

      expect(points).toBe(0);
    });

    it('returns zero when predicting a draw without choosing an advancing team', () => {
      const points = service.calculatePredictionPoints(
        { homeGoals: 1, awayGoals: 1 },
        {
          homeGoals: 2,
          awayGoals: 0,
          phase: Phase.ROUND_OF_16,
          winnerSide: TeamSide.HOME,
        },
      );

      expect(points).toBe(0);
    });
  });
});
