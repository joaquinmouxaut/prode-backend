import { Phase } from '@prisma/client';
export declare class UpdateMatchDto {
    homeTeam?: string;
    awayTeam?: string;
    date?: string;
    phase?: Phase;
    homeGoals?: number;
    awayGoals?: number;
}
