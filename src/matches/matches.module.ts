import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchLifecycleService } from './match-lifecycle.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [PrismaModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchLifecycleService],
  exports: [MatchesService, MatchLifecycleService],
})
export class MatchesModule {}
