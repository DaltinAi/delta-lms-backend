import { Module } from '@nestjs/common';
import { StageGroupsController } from './stage-groups.controller';
import { StageGroupsService } from './stage-groups.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [StageGroupsController],
  providers: [StageGroupsService],
})
export class StageGroupsModule {}
