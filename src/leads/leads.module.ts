import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { UsersModule } from '../users/users.module';
import { DbService } from '../db/db.service';

@Module({
  imports: [UsersModule],
  controllers: [LeadsController],
  providers: [LeadsService, DbService],
  exports: [LeadsService],
})
export class LeadsModule {}
