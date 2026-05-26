import { Phase } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
export declare class MatchesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(phase?: Phase): import("@prisma/client").Prisma.PrismaPromise<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        homeGoals: number | null;
        awayGoals: number | null;
        date: Date;
        phase: import("@prisma/client").$Enums.Phase;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        homeGoals: number | null;
        awayGoals: number | null;
        date: Date;
        phase: import("@prisma/client").$Enums.Phase;
    }>;
    create(dto: CreateMatchDto): import("@prisma/client").Prisma.Prisma__MatchClient<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        homeGoals: number | null;
        awayGoals: number | null;
        date: Date;
        phase: import("@prisma/client").$Enums.Phase;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: number, dto: UpdateMatchDto): Promise<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        homeGoals: number | null;
        awayGoals: number | null;
        date: Date;
        phase: import("@prisma/client").$Enums.Phase;
    }>;
    remove(id: number): Promise<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        homeGoals: number | null;
        awayGoals: number | null;
        date: Date;
        phase: import("@prisma/client").$Enums.Phase;
    }>;
}
