import { MatchDecision, TeamSide } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class SetMatchResultDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  homeGoals!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  awayGoals!: number;

  /** Equipo que avanza (mata-mata). Requerido si el marcador es empate. */
  @IsOptional()
  @IsEnum(TeamSide)
  winnerSide?: TeamSide;

  /** Cómo se definió (REGULAR/EXTRA_TIME/PENALTIES). Opcional. */
  @IsOptional()
  @IsEnum(MatchDecision)
  decidedBy?: MatchDecision;
}
