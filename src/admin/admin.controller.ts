import { Body, Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SetMatchResultDto } from './dto/set-match-result.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('matches/:id/result')
  setMatchResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetMatchResultDto,
  ) {
    return this.adminService.setMatchResultAndRecalculate(id, body.homeGoals, body.awayGoals);
  }
}
