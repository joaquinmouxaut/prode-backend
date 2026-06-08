import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetTournamentResultsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  championTeam?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  topScorerPlayer?: string;
}
