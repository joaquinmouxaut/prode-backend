import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FixturesModule } from '../fixtures/fixtures.module';
import { ResultsModule } from '../results/results.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ResultsModule, FixturesModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
