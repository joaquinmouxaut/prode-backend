import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { MatchesModule } from './matches/matches.module';
import { PointsModule } from './points/points.module';
import { PredictionsModule } from './predictions/predictions.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    PointsModule,
    UsersModule,
    MatchesModule,
    PredictionsModule,
    LeaderboardModule,
    AdminModule,
    AuthModule,
  ],
})
export class AppModule {}
