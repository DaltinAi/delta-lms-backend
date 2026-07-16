import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CallsByAgentDto, CallsByLeadDto, BaseCallQueryDto } from './dto/calls.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly errorService: ErrorService
  ) {}

  @Post('by-agent')
  async getCallsByAgent(@Body() body: CallsByAgentDto, @CurrentUser() user: any) {
    try {
      const agentId = user.role === 'admin' && body.agentId ? body.agentId : user.userId;
      return await this.callsService.proxyCall('by-agent', {
        ...body,
        companyId: user.company_id || '00000000-0000-0000-0000-000000000000',
        agentId,
        requesterId: user.userId,
        requesterRole: user.role,
      });
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Post('by-lead')
  async getCallsByLead(@Body() body: CallsByLeadDto, @CurrentUser() user: any) {
    try {
      return await this.callsService.proxyCall('by-lead', {
        ...body,
        companyId: user.company_id || '00000000-0000-0000-0000-000000000000',
        requesterId: user.userId,
        requesterRole: user.role,
      });
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Post('incoming')
  async getIncomingCalls(@Body() body: BaseCallQueryDto, @CurrentUser() user: any) {
    try {
      return await this.callsService.proxyCall('incoming', {
        ...body,
        companyId: user.company_id || '00000000-0000-0000-0000-000000000000',
        requesterId: user.userId,
        requesterRole: user.role,
      });
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Post('performance')
  async getPerformance(@Body() body: BaseCallQueryDto, @CurrentUser() user: any) {
    try {
      return await this.callsService.proxyCall('performance', {
        ...body,
        companyId: user.company_id || '00000000-0000-0000-0000-000000000000',
        requesterId: user.userId,
        requesterRole: user.role,
      });
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }
}
