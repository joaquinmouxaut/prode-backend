import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

@Module({
  imports: [MatchesModule, PredictionsModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
})
export class ParticipantsModule {}
