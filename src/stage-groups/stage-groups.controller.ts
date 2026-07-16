import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { StageGroupsService } from './stage-groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStageGroupDto } from './dto/stage-group.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('stage-groups')
@UseGuards(JwtAuthGuard)
export class StageGroupsController {
  constructor(
    private readonly stageGroupsService: StageGroupsService,
    private readonly errorService: ErrorService,
  ) {}

  @Post()
  async createStageGroup(
    @Body() dto: CreateStageGroupDto,
    @CurrentUser() user: any,
  ) {
    try {
      if (user.role !== 'admin') {
        this.errorService.errorThrower(403, {
          message: 'Admin access required',
        });
      }
      return await this.stageGroupsService.createStageGroup(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        dto,
      );
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get()
  async getStageGroups(@CurrentUser() user: any) {
    try {
      return await this.stageGroupsService.getStageGroups(
        user.company_id || '00000000-0000-0000-0000-000000000000',
      );
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
