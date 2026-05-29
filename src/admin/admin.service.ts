import { Injectable } from '@nestjs/common';
import { FixtureSyncService } from '../fixtures/fixture-sync.service';
import { ResultRecalculationService } from '../results/result-recalculation.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly recalcService: ResultRecalculationService,
    private readonly fixtureSyncService: FixtureSyncService,
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
      setManualOverride: true,
      bypassManualOverride: true,
      externalStatus: 'MANUAL',
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
}
