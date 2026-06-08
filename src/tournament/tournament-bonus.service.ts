import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserTotalsService } from './user-totals.service';

@Injectable()
export class TournamentBonusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userTotals: UserTotalsService,
  ) {}

  getConfig() {
    return this.userTotals.getTournamentConfig();
  }

  async setOfficialResults(input: {
    championTeam?: string | null;
    topScorerPlayer?: string | null;
  }) {
    const config = await this.prisma.tournamentConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        championTeam: input.championTeam ?? null,
        topScorerPlayer: input.topScorerPlayer ?? null,
      },
      update: {
        ...(input.championTeam !== undefined
          ? { championTeam: input.championTeam }
          : {}),
        ...(input.topScorerPlayer !== undefined
          ? { topScorerPlayer: input.topScorerPlayer }
          : {}),
      },
    });

    const recalculatedUsers = await this.userTotals.recomputeAllUsers();

    return {
      config,
      recalculatedUsers: recalculatedUsers.length,
    };
  }
}
