import { Controller, Get, Query, Req } from '@nestjs/common';
import { TelecallerAnalyticsStrategy } from './strategies/telecaller-analytics.strategy';

@Controller('reports')
export class ReportsController {
  constructor(private readonly analyticsStrategy: TelecallerAnalyticsStrategy) {}

  @Get('telecaller-analytics')
  async getTelecallerAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('targetUserId') targetUserId: string,
    @Req() req: any,
  ) {
    const requesterId = req.user?.id; // In a real app with auth guard
    const analytics = await this.analyticsStrategy.getAnalytics({
      startDate,
      endDate,
      targetUserId,
      requesterId,
    });
    return analytics;
  }
}
