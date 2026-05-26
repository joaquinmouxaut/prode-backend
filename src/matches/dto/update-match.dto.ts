import { Phase } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  homeTeam?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  awayTeam?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(Phase)
  phase?: Phase;

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
