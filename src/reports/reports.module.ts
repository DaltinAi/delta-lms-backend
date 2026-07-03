import { Module } from '@nestjs/common';
import { TelecallerAnalyticsStrategy } from './strategies/telecaller-analytics.strategy';
import { ReportsController } from './reports.controller';
import { DbService } from '../db/db.service';

@Module({
  controllers: [ReportsController],
  providers: [TelecallerAnalyticsStrategy, DbService],
  exports: [TelecallerAnalyticsStrategy],
})
export class ReportsModule {}
