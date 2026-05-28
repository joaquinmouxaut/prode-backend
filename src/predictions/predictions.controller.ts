import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';
import { PredictionsService } from './predictions.service';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePredictionDto) {
    return this.predictionsService.create(dto);
  }

  @Get()
  findAll(
    @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
    @Query('matchId', new ParseIntPipe({ optional: true })) matchId?: number,
  ) {
    return this.predictionsService.findAll({ userId, matchId });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.predictionsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePredictionDto,
  ) {
    return this.predictionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.predictionsService.remove(id);
  }
}
