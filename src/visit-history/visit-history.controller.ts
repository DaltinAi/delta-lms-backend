import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { VisitHistoryService } from './visit-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitHistoryController {
  constructor(
    private readonly visitHistoryService: VisitHistoryService,
    private readonly errorService: ErrorService
  ) {}

  @Post()
  async createVisit(
    @Body() dto: CreateVisitDto,
    @CurrentUser() user: any
  ) {
    try {
      const visit = await this.visitHistoryService.createVisit(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        user.userId,
        dto
      );
      return { status: 201, message: 'Visit recorded successfully', data: visit };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Get()
  async getVisits(
    @Query('filter') filter: string,
    @CurrentUser() user: any
  ) {
    try {
      const data = await this.visitHistoryService.getVisits(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        filter
      );
      return { status: 200, data };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }
}
