import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FixturesModule } from '../fixtures/fixtures.module';
import { ResultsModule } from '../results/results.module';
import { TournamentModule } from '../tournament/tournament.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ResultsModule, FixturesModule, AuthModule, TournamentModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
