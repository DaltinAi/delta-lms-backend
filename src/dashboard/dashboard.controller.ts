import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ErrorService } from '../common/error/error.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly errorService: ErrorService
  ) {}

  @Get('stats')
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any
  ) {
    try {
      const stats = await this.dashboardService.getStats(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        user.userId,
        user.role,
        startDate,
        endDate
      );
      return stats;
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }
}
