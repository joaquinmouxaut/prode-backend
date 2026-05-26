import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private readonly prisma;
    private readonly pointsService;
    constructor(prisma: PrismaService, pointsService: PointsService);
    setMatchResultAndRecalculate(matchId: number, homeGoals: number, awayGoals: number): Promise<{
        matchId: number;
        recalculatedPredictions: number;
        recalculatedUsers: number;
    }>;
}
