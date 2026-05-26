import { Phase } from '@prisma/client';
export declare class CreateMatchDto {
    homeTeam: string;
    awayTeam: string;
    date: string;
    phase: Phase;
    homeGoals?: number;
    awayGoals?: number;
}
