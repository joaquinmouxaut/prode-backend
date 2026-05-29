import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SetMatchResultDto } from './dto/set-match-result.dto';

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
}
