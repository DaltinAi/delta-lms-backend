import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
