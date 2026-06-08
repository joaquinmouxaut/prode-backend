import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isMatchStarted } from './match-lifecycle';

const matchLifecycleSelect = {
  id: true,
  date: true,
  externalStatus: true,
  homeGoals: true,
  awayGoals: true,
} as const;

@Injectable()
export class MatchLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async getFirstMatch() {
    return this.prisma.match.findFirst({
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: matchLifecycleSelect,
    });
  }

  async hasTournamentStarted(now = new Date()): Promise<boolean> {
    const firstMatch = await this.getFirstMatch();
    if (!firstMatch) {
      return false;
    }

    return isMatchStarted(firstMatch, now);
  }

  async getTournamentStatus(now = new Date()) {
    const firstMatch = await this.getFirstMatch();
    const picksLocked = firstMatch
      ? isMatchStarted(firstMatch, now)
      : false;

    return {
      picksLocked,
      firstMatchDate: firstMatch?.date.toISOString() ?? null,
      firstMatchId: firstMatch?.id ?? null,
    };
  }

  async ensureTournamentPicksOpen(now = new Date()): Promise<void> {
    if (await this.hasTournamentStarted(now)) {
      throw new ConflictException(
        'Champion and top scorer picks are locked after the first kickoff',
      );
    }
  }

  async ensureMatchOpenForPredictions(
    matchId: number,
    now = new Date(),
  ): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: matchLifecycleSelect,
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (isMatchStarted(match, now)) {
      throw new ConflictException('Predictions are locked after kickoff');
    }
  }
}
