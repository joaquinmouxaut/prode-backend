import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdatePredictionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  homeGoals?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  awayGoals?: number;
}
