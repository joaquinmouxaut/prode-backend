import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters?: { userId?: number; matchId?: number }) {
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

  async findOne(id: number) {
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
      throw new NotFoundException(`Prediction ${id} not found`);
    }
    return prediction;
  }

  async create(dto: CreatePredictionDto) {
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
    } catch (e: unknown) {
      if (this.isUniqueConstraint(e)) {
        throw new ConflictException(
          `User ${dto.userId} already has a prediction for match ${dto.matchId}`,
        );
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdatePredictionDto) {
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

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.prediction.delete({ where: { id } });
  }

  private async ensureUserExists(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  private async ensureMatchExists(id: number) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!match) {
      throw new NotFoundException(`Match ${id} not found`);
    }
  }

  private isUniqueConstraint(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    );
  }
}
