import { Module } from '@nestjs/common';
import { VisitHistoryController } from './visit-history.controller';
import { VisitHistoryService } from './visit-history.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [VisitHistoryController],
  providers: [VisitHistoryService],
  exports: [VisitHistoryService]
})
export class VisitHistoryModule {}
