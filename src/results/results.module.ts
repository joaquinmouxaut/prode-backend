import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { ResultRecalculationService } from './result-recalculation.service';

@Module({
  imports: [PointsModule],
  providers: [ResultRecalculationService],
  exports: [ResultRecalculationService],
})
export class ResultsModule {}
