import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SetMatchResultDto } from './dto/set-match-result.dto';
import { SetTournamentResultsDto } from './dto/set-tournament-results.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('matches/:id/result')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  setMatchResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetMatchResultDto,
  ) {
    return this.adminService.setMatchResultAndRecalculate(
      id,
      body.homeGoals,
      body.awayGoals,
    );
  }

  @Post('matches/:id/unlock-sync')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  unlockSync(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.clearManualOverride(id);
  }

  @Post('fixture/import')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  importFixture() {
    return this.adminService.importFixture();
  }

  @Get('sync/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getSyncStatus() {
    return this.adminService.getSyncStatus();
  }

  @Post('sync/run')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  runSyncNow() {
    return this.adminService.runSyncNow();
  }

  @Get('tournament/results')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getTournamentResults() {
    return this.adminService.getTournamentResults();
  }

  @Patch('tournament/results')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  setTournamentResults(@Body() body: SetTournamentResultsDto) {
    return this.adminService.setTournamentResults(body);
  }
}
