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
exports.MatchesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MatchesService = class MatchesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(phase) {
        return this.prisma.match.findMany({
            where: phase ? { phase } : undefined,
            orderBy: [{ date: 'asc' }, { id: 'asc' }],
        });
    }
    async findOne(id) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) {
            throw new common_1.NotFoundException(`Match ${id} not found`);
        }
        return match;
    }
    create(dto) {
        return this.prisma.match.create({
            data: {
                homeTeam: dto.homeTeam,
                awayTeam: dto.awayTeam,
                date: new Date(dto.date),
                phase: dto.phase,
                homeGoals: dto.homeGoals ?? null,
                awayGoals: dto.awayGoals ?? null,
            },
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        const { date, ...rest } = dto;
        return this.prisma.match.update({
            where: { id },
            data: {
                ...rest,
                ...(date !== undefined ? { date: new Date(date) } : {}),
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.match.delete({ where: { id } });
    }
};
exports.MatchesService = MatchesService;
exports.MatchesService = MatchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MatchesService);
//# sourceMappingURL=matches.service.js.map