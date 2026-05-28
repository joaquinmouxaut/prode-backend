import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PointsModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
