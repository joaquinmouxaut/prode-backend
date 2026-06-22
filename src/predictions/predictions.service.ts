import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Phase, Role, TeamSide } from '@prisma/client';
import { isMatchStarted } from '../matches/match-lifecycle';
import {
  deriveAdvancingTeam,
  isKnockoutPhase,
} from '../matches/match-phase.util';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';

const predictionInclude = {
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
      externalStatus: true,
    },
  },
} as const;

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchLifecycle: MatchLifecycleService,
  ) {}

  async findVisible(
    viewerUserId: number,
    filters?: { userId?: number; matchId?: number },
  ) {
    if (filters?.matchId !== undefined) {
      const match = await this.prisma.match.findUnique({
        where: { id: filters.matchId },
        select: {
          id: true,
          date: true,
          externalStatus: true,
        },
      });
      if (!match) {
        throw new NotFoundException(`Match ${filters.matchId} not found`);
      }

      const started = isMatchStarted(match);
      if (
        filters.userId !== undefined &&
        filters.userId !== viewerUserId &&
        !started
      ) {
        throw new ForbiddenException(
          'Predictions for other users are visible only after kickoff',
        );
      }

      return this.prisma.prediction.findMany({
        where: {
          matchId: filters.matchId,
          ...(started
            ? this.buildVisibleUserWhere(viewerUserId, filters.userId)
            : { userId: viewerUserId }),
        },
        include: predictionInclude,
        orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
      });
    }

    if (filters?.userId !== undefined && filters.userId !== viewerUserId) {
      const startedMatchIds = await this.getStartedMatchIds();

      return this.prisma.prediction.findMany({
        where: {
          userId: filters.userId,
          user: { role: Role.USER },
          matchId: { in: startedMatchIds },
        },
        include: predictionInclude,
        orderBy: [{ match: { date: 'asc' } }, { matchId: 'asc' }],
      });
    }

    const matches = await this.prisma.match.findMany({
      select: {
        id: true,
        date: true,
        externalStatus: true,
      },
    });
    const startedMatchIds = matches
      .filter((match) => isMatchStarted(match))
      .map((match) => match.id);

    return this.prisma.prediction.findMany({
      where: {
        AND: [
          {
            OR: [
              { userId: viewerUserId },
              { matchId: { in: startedMatchIds } },
            ],
          },
          this.buildVisibleUserWhere(viewerUserId),
        ],
      },
      include: predictionInclude,
      orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
    });
  }

  private buildVisibleUserWhere(
    viewerUserId: number,
    targetUserId?: number,
  ): { userId: number } | { userId: number; user: { role: Role } } | { OR: Array<{ userId: number } | { user: { role: Role } }> } {
    if (targetUserId !== undefined) {
      if (targetUserId === viewerUserId) {
        return { userId: targetUserId };
      }

      return { userId: targetUserId, user: { role: Role.USER } };
    }

    return {
      OR: [{ userId: viewerUserId }, { user: { role: Role.USER } }],
    };
  }

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
            externalStatus: true,
          },
        },
      },
    });
    if (!prediction) {
      throw new NotFoundException(`Prediction ${id} not found`);
    }
    return prediction;
  }

  /**
   * En mata-mata el jugador debe definir qué equipo avanza: si el marcador es
   * decisivo se deriva, si es empate debe elegirlo explícitamente. En grupos es null.
   */
  private resolveAdvancingTeam(
    phase: Phase,
    homeGoals: number,
    awayGoals: number,
    provided: TeamSide | null | undefined,
  ): TeamSide | null {
    if (!isKnockoutPhase(phase)) {
      return null;
    }
    const resolved = provided ?? deriveAdvancingTeam(homeGoals, awayGoals);
    if (!resolved) {
      throw new BadRequestException(
        'Elegí el equipo que avanza para este partido de eliminatoria',
      );
    }
    return resolved;
  }

  private async getMatchPhase(matchId: number): Promise<Phase> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { phase: true },
    });
    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }
    return match.phase;
  }

  async create(dto: CreatePredictionDto) {
    await this.ensureUserExists(dto.userId);
    await this.matchLifecycle.ensureMatchOpenForPredictions(dto.matchId);
    const phase = await this.getMatchPhase(dto.matchId);
    const advancingTeam = this.resolveAdvancingTeam(
      phase,
      dto.homeGoals,
      dto.awayGoals,
      dto.advancingTeam,
    );
    try {
      return await this.prisma.prediction.create({
        data: {
          userId: dto.userId,
          matchId: dto.matchId,
          homeGoals: dto.homeGoals,
          awayGoals: dto.awayGoals,
          advancingTeam,
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
    const prediction = await this.findOne(id);
    await this.matchLifecycle.ensureMatchOpenForPredictions(prediction.matchId);
    const homeGoals = dto.homeGoals ?? prediction.homeGoals;
    const awayGoals = dto.awayGoals ?? prediction.awayGoals;
    const advancingTeam = this.resolveAdvancingTeam(
      prediction.match.phase,
      homeGoals,
      awayGoals,
      dto.advancingTeam ?? prediction.advancingTeam,
    );
    return this.prisma.prediction.update({
      where: { id },
      data: {
        ...(dto.homeGoals !== undefined ? { homeGoals: dto.homeGoals } : {}),
        ...(dto.awayGoals !== undefined ? { awayGoals: dto.awayGoals } : {}),
        advancingTeam,
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

  async remove(id: number) {
    const prediction = await this.findOne(id);
    await this.matchLifecycle.ensureMatchOpenForPredictions(prediction.matchId);
    return this.prisma.prediction.delete({ where: { id } });
  }

  private async getStartedMatchIds(): Promise<number[]> {
    const matches = await this.prisma.match.findMany({
      select: {
        id: true,
        date: true,
        externalStatus: true,
      },
    });

    return matches
      .filter((match) => isMatchStarted(match))
      .map((match) => match.id);
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

  private isUniqueConstraint(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    );
  }
}
