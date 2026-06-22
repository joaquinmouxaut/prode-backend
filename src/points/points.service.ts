import { Injectable } from '@nestjs/common';
import { Phase, TeamSide } from '@prisma/client';
import {
  deriveAdvancingTeam,
  isKnockoutPhase,
} from '../matches/match-phase.util';

type MatchScore = {
  homeGoals: number | null;
  awayGoals: number | null;
  phase: Phase;
  /** Lado que avanza (mata-mata). Si falta y el marcador es decisivo, se deriva. */
  winnerSide?: TeamSide | null;
};

type PredictionScore = {
  homeGoals: number;
  awayGoals: number;
  /** Lado que el jugador eligió como ganador (mata-mata). */
  advancingTeam?: TeamSide | null;
};

const OUTCOME_POINTS = 4;

const BONUS = {
  EXACT: 4,
  GOAL_DIFF: 2,
  SINGLE_TEAM: 1,
  NONE: 0,
} as const;

const PHASE_MULTIPLIERS: Record<Phase, number> = {
  [Phase.GROUPS_1]: 1,
  [Phase.GROUPS_2]: 1,
  [Phase.GROUPS_3]: 1,
  [Phase.ROUND_OF_32]: 2,
  [Phase.ROUND_OF_16]: 2,
  [Phase.QUARTER_FINAL]: 2,
  [Phase.SEMI_FINAL]: 2,
  [Phase.THIRD_PLACE]: 2,
  [Phase.FINAL]: 3,
};

@Injectable()
export class PointsService {
  calculatePredictionPoints(
    prediction: PredictionScore,
    match: MatchScore,
  ): number {
    if (match.homeGoals === null || match.awayGoals === null) {
      return 0;
    }

    const realHome = match.homeGoals;
    const realAway = match.awayGoals;
    const predHome = prediction.homeGoals;
    const predAway = prediction.awayGoals;

    if (isKnockoutPhase(match.phase)) {
      return this.calculateKnockoutPoints(prediction, match);
    }

    if (
      this.getOutcome(predHome, predAway) !==
      this.getOutcome(realHome, realAway)
    ) {
      return 0;
    }

    const bonus = this.getHighestBonus(predHome, predAway, realHome, realAway);
    return (OUTCOME_POINTS + bonus) * this.getPhaseMultiplier(match.phase);
  }

  /**
   * Puntaje de mata-mata: el "gate" es acertar el equipo que avanza (no el signo).
   * Si se acierta el avance: 4 base + bonus más alto (sobre el marcador de
   * 90'+prórroga) × multiplicador de fase. Si no: 0.
   */
  private calculateKnockoutPoints(
    prediction: PredictionScore,
    match: MatchScore,
  ): number {
    const realHome = match.homeGoals as number;
    const realAway = match.awayGoals as number;
    const predHome = prediction.homeGoals;
    const predAway = prediction.awayGoals;

    const realAdvancer =
      match.winnerSide ?? deriveAdvancingTeam(realHome, realAway);
    const predAdvancer =
      prediction.advancingTeam ?? deriveAdvancingTeam(predHome, predAway);

    if (!realAdvancer || !predAdvancer || predAdvancer !== realAdvancer) {
      return 0;
    }

    const bonus = this.getHighestBonus(predHome, predAway, realHome, realAway);
    return (OUTCOME_POINTS + bonus) * this.getPhaseMultiplier(match.phase);
  }

  private getHighestBonus(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
  ): number {
    if (predHome === realHome && predAway === realAway) {
      return BONUS.EXACT;
    }

    if (predHome - predAway === realHome - realAway) {
      return BONUS.GOAL_DIFF;
    }

    const homeMatch = predHome === realHome;
    const awayMatch = predAway === realAway;
    if (homeMatch !== awayMatch) {
      return BONUS.SINGLE_TEAM;
    }

    return BONUS.NONE;
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
