import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { TournamentModule } from '../tournament/tournament.module';
import { ResultRecalculationService } from './result-recalculation.service';

@Module({
  imports: [PointsModule, TournamentModule],
  providers: [ResultRecalculationService],
  exports: [ResultRecalculationService],
})
export class ResultsModule {}
