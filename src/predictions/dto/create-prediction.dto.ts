import { TeamSide } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

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

  /** Equipo que el jugador cree que avanza (solo mata-mata). */
  @IsOptional()
  @IsEnum(TeamSide)
  advancingTeam?: TeamSide;
}
