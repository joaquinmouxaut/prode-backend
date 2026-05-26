import { Injectable } from '@nestjs/common';
import { Phase } from '@prisma/client';

type MatchScore = {
  homeGoals: number | null;
  awayGoals: number | null;
  phase: Phase;
};

type PredictionScore = {
  homeGoals: number;
  awayGoals: number;
};

const PHASE_MULTIPLIERS: Record<Phase, number> = {
  [Phase.GROUPS_1]: 1,
  [Phase.GROUPS_2]: 1,
  [Phase.GROUPS_3]: 1,
  [Phase.ROUND_OF_16]: 2,
  [Phase.QUARTER_FINAL]: 2,
  [Phase.SEMI_FINAL]: 2,
  [Phase.THIRD_PLACE]: 2,
  [Phase.FINAL]: 3,
};

@Injectable()
export class PointsService {
  calculatePredictionPoints(prediction: PredictionScore, match: MatchScore): number {
    if (match.homeGoals === null || match.awayGoals === null) {
      return 0;
    }

    const realHome = match.homeGoals;
    const realAway = match.awayGoals;
    const predHome = prediction.homeGoals;
    const predAway = prediction.awayGoals;

    let basePoints = 0;

    if (this.getOutcome(predHome, predAway) === this.getOutcome(realHome, realAway)) {
      basePoints += 4;
    }

    if (predHome === realHome && predAway === realAway) {
      basePoints += 4;
    }

    if (predHome - predAway === realHome - realAway) {
      basePoints += 2;
    }

    if (predHome === realHome) {
      basePoints += 1;
    }

    if (predAway === realAway) {
      basePoints += 1;
    }

    return basePoints * this.getPhaseMultiplier(match.phase);
  }

  private getOutcome(homeGoals: number, awayGoals: number): 'H' | 'D' | 'A' {
    if (homeGoals > awayGoals) {
      return 'H';
    }

    if (homeGoals < awayGoals) {
      return 'A';
    }

    return 'D';
  }

  private getPhaseMultiplier(phase: Phase): number {
    return PHASE_MULTIPLIERS[phase];
  }
}
