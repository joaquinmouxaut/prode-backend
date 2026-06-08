import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TournamentBonusService } from './tournament-bonus.service';
import { TournamentStatusController } from './tournament-status.controller';
import { UserTotalsService } from './user-totals.service';

@Module({
  imports: [PrismaModule, MatchesModule],
  controllers: [TournamentStatusController],
  providers: [UserTotalsService, TournamentBonusService],
  exports: [UserTotalsService, TournamentBonusService],
})
export class TournamentModule {}
