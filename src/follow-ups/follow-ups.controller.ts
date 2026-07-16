import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('follow-ups')
@UseGuards(JwtAuthGuard)
export class FollowUpsController {
  constructor(
    private readonly followUpsService: FollowUpsService,
    private readonly errorService: ErrorService,
  ) {}

  @Post()
  async createFollowUp(
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() user: any,
  ) {
    try {
      const followUp = await this.followUpsService.createFollowUp(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        user.userId,
        dto,
      );
      return { status: 201, message: 'Follow-up scheduled', data: followUp };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get()
  async getFollowUps(
    @Query('filter') filter: string,
    @CurrentUser() user: any,
  ) {
    try {
      const data = await this.followUpsService.getFollowUps(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        filter,
      );
      return { status: 200, data };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Patch(':id/complete')
  async completeFollowUp(@Param('id') id: string, @CurrentUser() user: any) {
    try {
      const data = await this.followUpsService.completeFollowUp(
        id,
        user.company_id || '00000000-0000-0000-0000-000000000000',
      );
      return { status: 200, message: 'Follow-up marked as completed', data };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
