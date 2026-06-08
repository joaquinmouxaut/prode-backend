import { Controller, Get } from '@nestjs/common';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';

@Controller('tournament')
export class TournamentStatusController {
  constructor(private readonly matchLifecycle: MatchLifecycleService) {}

  @Get('status')
  getStatus() {
    return this.matchLifecycle.getTournamentStatus();
  }
}
