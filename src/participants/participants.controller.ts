import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  CurrentUser,
  type CurrentUserData,
} from '../auth/decorators/current-user.decorator';
import { ParticipantsService } from './participants.service';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get(':id/profile')
  getProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.participantsService.getProfile(user.id, id);
  }
}
