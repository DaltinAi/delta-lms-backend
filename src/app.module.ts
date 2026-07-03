import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeadsModule } from './leads/leads.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [DbModule, AuthModule, UsersModule, LeadsModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
