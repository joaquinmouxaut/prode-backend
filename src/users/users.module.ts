import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { TournamentModule } from '../tournament/tournament.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TournamentModule, MatchesModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
