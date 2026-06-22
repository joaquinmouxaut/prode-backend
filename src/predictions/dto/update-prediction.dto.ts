import { TeamSide } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min, IsOptional } from 'class-validator';

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

  /** Equipo que el jugador cree que avanza (solo mata-mata). */
  @IsOptional()
  @IsEnum(TeamSide)
  advancingTeam?: TeamSide;
}
