import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { StagesService } from './stages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStageDto } from './dto/create-stage.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('stages')
@UseGuards(JwtAuthGuard)
export class StagesController {
  constructor(
    private readonly stagesService: StagesService,
    private readonly errorService: ErrorService,
  ) {}

  @Post()
  async createStage(@Body() dto: CreateStageDto, @CurrentUser() user: any) {
    try {
      const stage = await this.stagesService.createStage(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        dto,
      );
      return {
        status: 201,
        message: 'Stage created successfully',
        data: stage,
      };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get()
  async getStages(@CurrentUser() user: any) {
    try {
      const companyId = user.company_id || '00000000-0000-0000-0000-000000000000';
      const data = user.role && user.role.toLowerCase() !== 'admin'
        ? await this.stagesService.getStages(companyId, user.role)
        : await this.stagesService.getStages(companyId);
      return { status: 200, data };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
