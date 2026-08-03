import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { DbService } from '../db/db.service';

@Module({
  providers: [AppointmentsService, DbService],
  controllers: [AppointmentsController]
})
export class AppointmentsModule {}
