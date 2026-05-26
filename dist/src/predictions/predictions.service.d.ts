import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';
export declare class PredictionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(filters?: {
        userId?: number;
        matchId?: number;
    }): import("@prisma/client").Prisma.PrismaPromise<({
        user: {
            id: number;
            name: string;
            email: string;
        };
        match: {
            id: number;
            homeTeam: string;
            awayTeam: string;
            homeGoals: number | null;
            awayGoals: number | null;
            date: Date;
            phase: import("@prisma/client").$Enums.Phase;
        };
    } & {
        id: number;
        homeGoals: number;
        awayGoals: number;
        userId: number;
        matchId: number;
        points: number;
    })[]>;
    findOne(id: number): Promise<{
        user: {
            id: number;
            name: string;
            email: string;
        };
        match: {
            id: number;
            homeTeam: string;
            awayTeam: string;
            homeGoals: number | null;
            awayGoals: number | null;
            date: Date;
            phase: import("@prisma/client").$Enums.Phase;
        };
    } & {
        id: number;
        homeGoals: number;
        awayGoals: number;
        userId: number;
        matchId: number;
        points: number;
    }>;
    create(dto: CreatePredictionDto): Promise<{
        user: {
            id: number;
            name: string;
            email: string;
        };
        match: {
            id: number;
            homeTeam: string;
            awayTeam: string;
            homeGoals: number | null;
            awayGoals: number | null;
            date: Date;
            phase: import("@prisma/client").$Enums.Phase;
        };
    } & {
        id: number;
        homeGoals: number;
        awayGoals: number;
        userId: number;
        matchId: number;
        points: number;
    }>;
    update(id: number, dto: UpdatePredictionDto): Promise<{
        user: {
            id: number;
            name: string;
            email: string;
        };
        match: {
            id: number;
            homeTeam: string;
            awayTeam: string;
            homeGoals: number | null;
            awayGoals: number | null;
            date: Date;
            phase: import("@prisma/client").$Enums.Phase;
        };
    } & {
        id: number;
        homeGoals: number;
        awayGoals: number;
        userId: number;
        matchId: number;
        points: number;
    }>;
    remove(id: number): Promise<{
        id: number;
        homeGoals: number;
        awayGoals: number;
        userId: number;
        matchId: number;
        points: number;
    }>;
    private ensureUserExists;
    private ensureMatchExists;
    private isUniqueConstraint;
}
