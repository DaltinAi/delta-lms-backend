import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeadsModule } from './leads/leads.module';
import { ReportsModule } from './reports/reports.module';
import { CompaniesModule } from './companies/companies.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { StagesModule } from './stages/stages.module';
import { VisitHistoryModule } from './visit-history/visit-history.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InvitationsModule } from './invitations/invitations.module';
import { StageGroupsModule } from './stage-groups/stage-groups.module';
import { RolePermissionsModule } from './role-permissions/role-permissions.module';
import { CallsModule } from './calls/calls.module';
import { ErrorModule } from './common/error/error.module';

@Module({
  imports: [
    DbModule,
    ErrorModule,
    AuthModule,
    UsersModule,
    LeadsModule,
    ReportsModule,
    CompaniesModule,
    FollowUpsModule,
    StagesModule,
    VisitHistoryModule,
    DashboardModule,
    InvitationsModule,
    StageGroupsModule,
    RolePermissionsModule,
    CallsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
