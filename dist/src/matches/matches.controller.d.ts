import { Phase } from '@prisma/client';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesService } from './matches.service';
export declare class MatchesController {
    private readonly matchesService;
    constructor(matchesService: MatchesService);
    create(dto: CreateMatchDto): import("@prisma/client").Prisma.Prisma__MatchClient<{
        id: number;
        homeTeam: string;
        awayTeam: string;
        homeGoals: number | null;
        awayGoals: number | null;
        date: Date;
        phase: import("@prisma/client").$Enums.Phase;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
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
