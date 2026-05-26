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
exports.PredictionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PredictionsService = class PredictionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(filters) {
        return this.prisma.prediction.findMany({
            where: {
                ...(filters?.userId !== undefined ? { userId: filters.userId } : {}),
                ...(filters?.matchId !== undefined ? { matchId: filters.matchId } : {}),
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                match: {
                    select: {
                        id: true,
                        homeTeam: true,
                        awayTeam: true,
                        homeGoals: true,
                        awayGoals: true,
                        date: true,
                        phase: true,
                    },
                },
            },
            orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
        });
    }
    async findOne(id) {
        const prediction = await this.prisma.prediction.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                match: {
                    select: {
                        id: true,
                        homeTeam: true,
                        awayTeam: true,
                        homeGoals: true,
                        awayGoals: true,
                        date: true,
                        phase: true,
                    },
                },
            },
        });
        if (!prediction) {
            throw new common_1.NotFoundException(`Prediction ${id} not found`);
        }
        return prediction;
    }
    async create(dto) {
        await this.ensureUserExists(dto.userId);
        await this.ensureMatchExists(dto.matchId);
        try {
            return await this.prisma.prediction.create({
                data: {
                    userId: dto.userId,
                    matchId: dto.matchId,
                    homeGoals: dto.homeGoals,
                    awayGoals: dto.awayGoals,
                },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    match: {
                        select: {
                            id: true,
                            homeTeam: true,
                            awayTeam: true,
                            homeGoals: true,
                            awayGoals: true,
                            date: true,
                            phase: true,
                        },
                    },
                },
            });
        }
        catch (e) {
            if (this.isUniqueConstraint(e)) {
                throw new common_1.ConflictException(`User ${dto.userId} already has a prediction for match ${dto.matchId}`);
            }
            throw e;
        }
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.prediction.update({
            where: { id },
            data: dto,
            include: {
                user: { select: { id: true, name: true, email: true } },
                match: {
                    select: {
                        id: true,
                        homeTeam: true,
                        awayTeam: true,
                        homeGoals: true,
                        awayGoals: true,
                        date: true,
                        phase: true,
                    },
                },
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.prediction.delete({ where: { id } });
    }
    async ensureUserExists(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User ${id} not found`);
        }
    }
    async ensureMatchExists(id) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!match) {
            throw new common_1.NotFoundException(`Match ${id} not found`);
        }
    }
    isUniqueConstraint(e) {
        return (typeof e === 'object' &&
            e !== null &&
            'code' in e &&
            e.code === 'P2002');
    }
};
exports.PredictionsService = PredictionsService;
exports.PredictionsService = PredictionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PredictionsService);
//# sourceMappingURL=predictions.service.js.map