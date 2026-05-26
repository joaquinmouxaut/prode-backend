"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const points_service_1 = require("../points/points.service");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    pointsService;
    constructor(prisma, pointsService) {
        this.prisma = prisma;
        this.pointsService = pointsService;
    }
    async setMatchResultAndRecalculate(matchId, homeGoals, awayGoals) {
        const existingMatch = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: { id: true },
        });
        if (!existingMatch) {
            throw new common_1.NotFoundException(`Match ${matchId} not found`);
        }
        const match = await this.prisma.match.update({
            where: { id: matchId },
            data: { homeGoals, awayGoals },
        });
        const allPredictions = await this.prisma.prediction.findMany({
            include: {
                match: {
                    select: {
                        id: true,
                        homeGoals: true,
                        awayGoals: true,
                        phase: true,
                    },
                },
            },
        });
        const predictionUpdates = allPredictions.map((prediction) => this.prisma.prediction.update({
            where: { id: prediction.id },
            data: {
                points: this.pointsService.calculatePredictionPoints({ homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals }, prediction.match),
            },
        }));
        if (predictionUpdates.length > 0) {
            await this.prisma.$transaction(predictionUpdates);
        }
        const refreshedPredictions = await this.prisma.prediction.findMany({
            select: {
                userId: true,
                points: true,
                match: {
                    select: {
                        phase: true,
                    },
                },
            },
        });
        const users = await this.prisma.user.findMany({ select: { id: true } });
        const totalsByUser = new Map();
        for (const user of users) {
            totalsByUser.set(user.id, {
                totalPoints: 0,
                groups1: 0,
                groups2: 0,
                groups3: 0,
                knockout: 0,
            });
        }
        for (const prediction of refreshedPredictions) {
            const accumulator = totalsByUser.get(prediction.userId);
            if (!accumulator) {
                continue;
            }
            accumulator.totalPoints += prediction.points;
            if (prediction.match.phase === client_1.Phase.GROUPS_1) {
                accumulator.groups1 += prediction.points;
            }
            else if (prediction.match.phase === client_1.Phase.GROUPS_2) {
                accumulator.groups2 += prediction.points;
            }
            else if (prediction.match.phase === client_1.Phase.GROUPS_3) {
                accumulator.groups3 += prediction.points;
            }
            else {
                accumulator.knockout += prediction.points;
            }
        }
        const userUpdates = Array.from(totalsByUser.entries()).map(([userId, totals]) => this.prisma.user.update({
            where: { id: userId },
            data: totals,
        }));
        if (userUpdates.length > 0) {
            await this.prisma.$transaction(userUpdates);
        }
        return {
            matchId: match.id,
            recalculatedPredictions: allPredictions.length,
            recalculatedUsers: users.length,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        points_service_1.PointsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map