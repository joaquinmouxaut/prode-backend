import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SetMatchResultDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  homeGoals!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  awayGoals!: number;
}
