import { Injectable } from '@nestjs/common';
import { FixtureSyncService } from '../fixtures/fixture-sync.service';
import { ResultRecalculationService } from '../results/result-recalculation.service';
import { TournamentBonusService } from '../tournament/tournament-bonus.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly recalcService: ResultRecalculationService,
    private readonly fixtureSyncService: FixtureSyncService,
    private readonly tournamentBonusService: TournamentBonusService,
  ) {}

  async setMatchResultAndRecalculate(
    matchId: number,
    homeGoals: number,
    awayGoals: number,
  ) {
    return this.recalcService.applyMatchResult({
      matchId,
      homeGoals,
      awayGoals,
      source: 'ADMIN',
      syncedAt: new Date(),
    });
  }

  clearManualOverride(matchId: number) {
    return this.recalcService.clearManualOverride(matchId);
  }

  importFixture() {
    return this.fixtureSyncService.importFixture();
  }

  getSyncStatus() {
    return this.fixtureSyncService.getPollingStatus();
  }

  runSyncNow() {
    return this.fixtureSyncService.runManualSync();
  }

  getTournamentResults() {
    return this.tournamentBonusService.getConfig();
  }

  setTournamentResults(input: {
    championTeam?: string;
    topScorerPlayer?: string;
  }) {
    return this.tournamentBonusService.setOfficialResults(input);
  }
}
