import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

@Module({
  imports: [MatchesModule],
  controllers: [PredictionsController],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
