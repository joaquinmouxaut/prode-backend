import { Module } from '@nestjs/common';
import { ResultsModule } from '../results/results.module';
import { ApiFootballClient } from './api-football.client';
import { FixtureSyncService } from './fixture-sync.service';

@Module({
  imports: [ResultsModule],
  providers: [ApiFootballClient, FixtureSyncService],
  exports: [FixtureSyncService],
})
export class FixturesModule {}
