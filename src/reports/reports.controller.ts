import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TelecallerAnalyticsStrategy } from './strategies/telecaller-analytics.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ErrorService } from '../common/error/error.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly analyticsStrategy: TelecallerAnalyticsStrategy,
    private readonly errorService: ErrorService
  ) {}

  @Get('telecaller-analytics')
  async getTelecallerAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('targetUserId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const requesterId = user.userId;
      const companyId = user.company_id || '00000000-0000-0000-0000-000000000000';
      const analytics = await this.analyticsStrategy.getAnalytics({
        startDate,
        endDate,
        targetUserId,
        requesterId,
        companyId,
      });
      return analytics;
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }
}
