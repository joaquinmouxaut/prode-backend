import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PredictionsService } from '../predictions/predictions.service';
import { PrismaService } from '../prisma/prisma.service';

export type ParticipantProfile = {
  user: {
    id: number;
    name: string;
    email: string;
  };
  tournamentPicksVisible: boolean;
  championPick: string | null;
  topScorerPick: string | null;
  total: number;
  matchPoints: number;
  championPoints: number;
  topScorerPoints: number;
  groupsPoints: number;
  knockoutPoints: number;
  predictions: Awaited<ReturnType<PredictionsService['findVisible']>>;
};

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchLifecycle: MatchLifecycleService,
    private readonly predictions: PredictionsService,
  ) {}

  async getProfile(
    viewerUserId: number,
    targetUserId: number,
  ): Promise<ParticipantProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        championPick: true,
        topScorerPick: true,
        totalPoints: true,
        championPoints: true,
        topScorerPoints: true,
        groups1: true,
        groups2: true,
        groups3: true,
        knockout: true,
      },
    });

    if (!user || user.role === Role.ADMIN) {
      throw new NotFoundException(`Participant ${targetUserId} not found`);
    }

    const tournamentPicksVisible =
      await this.matchLifecycle.hasTournamentStarted();
    const predictions = await this.predictions.findVisible(viewerUserId, {
      userId: targetUserId,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      tournamentPicksVisible,
      championPick: tournamentPicksVisible ? user.championPick : null,
      topScorerPick: tournamentPicksVisible ? user.topScorerPick : null,
      total: user.totalPoints,
      matchPoints: user.groups1 + user.groups2 + user.groups3 + user.knockout,
      championPoints: user.championPoints,
      topScorerPoints: user.topScorerPoints,
      groupsPoints: user.groups1 + user.groups2 + user.groups3,
      knockoutPoints: user.knockout,
      predictions,
    };
  }
}
