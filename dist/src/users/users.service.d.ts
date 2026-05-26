import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: number;
        name: string;
        email: string;
        championPick: string | null;
        topScorerPick: string | null;
        totalPoints: number;
        groups1: number;
        groups2: number;
        groups3: number;
        knockout: number;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        name: string;
        email: string;
        championPick: string | null;
        topScorerPick: string | null;
        totalPoints: number;
        groups1: number;
        groups2: number;
        groups3: number;
        knockout: number;
    }>;
    create(dto: CreateUserDto): Promise<{
        id: number;
        name: string;
        email: string;
        championPick: string | null;
        topScorerPick: string | null;
        totalPoints: number;
        groups1: number;
        groups2: number;
        groups3: number;
        knockout: number;
    }>;
    update(id: number, dto: UpdateUserDto): Promise<{
        id: number;
        name: string;
        email: string;
        championPick: string | null;
        topScorerPick: string | null;
        totalPoints: number;
        groups1: number;
        groups2: number;
        groups3: number;
        knockout: number;
    }>;
    remove(id: number): Promise<{
        id: number;
        name: string;
        email: string;
        championPick: string | null;
        topScorerPick: string | null;
        totalPoints: number;
        groups1: number;
        groups2: number;
        groups3: number;
        knockout: number;
    }>;
    private isUniqueConstraint;
}
