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
export declare class PointsService {
    calculatePredictionPoints(prediction: PredictionScore, match: MatchScore): number;
    private getOutcome;
    private getPhaseMultiplier;
}
export {};
