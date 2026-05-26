import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreatePredictionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  matchId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  homeGoals!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  awayGoals!: number;
}
