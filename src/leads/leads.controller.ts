import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Query,
  Param,
  UseGuards,
  Patch,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ReassignLeadsDto, UpdateLeadStageDto } from './dto/lead-actions.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly errorService: ErrorService,
  ) {}

  @Post()
  async createLead(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: any,
  ) {
    try {
      const lead = await this.leadsService.createLead(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        user.userId,
        createLeadDto,
      );
      return { status: 201, message: 'Lead created successfully', data: lead };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Post('reassign')
  async reassignLeads(
    @Body() body: ReassignLeadsDto,
    @CurrentUser() user: any,
  ) {
    try {
      const assignedById = user.userId;
      const result = await this.leadsService.reassignLeads(
        body.leadIds,
        body.toAssigneeId,
        assignedById,
      );
      return result;
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get()
  async getLeads(@Query('filter') filter: string) {
    try {
      const leadsData = await this.leadsService.getLeads(filter);
      return { status: 200, ...leadsData };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Patch(':id')
  async updateLead(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    try {
      const lead = await this.leadsService.updateLead(
        id,
        user.company_id || '00000000-0000-0000-0000-000000000000',
        updateLeadDto,
      );
      if (!lead) {
        this.errorService.errorThrower(404, {
          message: `Lead with ID ${id} not found`,
        });
      }
      return { status: 200, message: 'Lead updated successfully', data: lead };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Patch(':id/stage')
  async updateLeadStage(
    @Param('id') id: string,
    @Body() body: UpdateLeadStageDto,
    @CurrentUser() user: any,
  ) {
    try {
      const result = await this.leadsService.updateLeadStage(
        id,
        user.company_id || '00000000-0000-0000-0000-000000000000',
        body.toStageId,
        user.userId,
        body.remark,
      );
      return { status: 200, ...result };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get(':id')
  async getLeadById(@Param('id') id: string) {
    try {
      const data = await this.leadsService.getLeadById(id);
      if (!data) {
        this.errorService.errorThrower(404, {
          message: `Lead with ID ${id} not found`,
        });
      }
      return { status: 200, data };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
