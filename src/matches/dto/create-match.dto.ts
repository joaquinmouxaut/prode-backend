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

export class CreateMatchDto {
  @IsString()
  @MinLength(1)
  homeTeam!: string;

  @IsString()
  @MinLength(1)
  awayTeam!: string;

  @IsDateString()
  date!: string;

  @IsEnum(Phase)
  phase!: Phase;

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
