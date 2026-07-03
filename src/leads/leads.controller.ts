import { Controller, Post, Body, Req, Get, Query, Param } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('reassign')
  async reassignLeads(
    @Body() body: { leadIds: string[]; toAssigneeId: string },
    @Req() req: any
  ) {
    // In a real app, assignedById would come from req.user
    // For now, we assume it's passed in or hardcoded
    const assignedById = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const result = await this.leadsService.reassignLeads(
      body.leadIds,
      body.toAssigneeId,
      assignedById
    );
    return result;
  }

  @Get('stages')
  async getStages() {
    const stages = await this.leadsService.getStages();
    return { status: 200, data: stages };
  }

  @Get()
  async getLeads(@Query('filter') filter: string) {
    const leadsData = await this.leadsService.getLeads(filter);
    return { status: 200, ...leadsData };
  }

  @Get('follow-ups')
  async getFollowUps(@Query('filter') filter: string) {
    const data = await this.leadsService.getFollowUps(filter);
    return { status: 200, data };
  }

  @Get(':id')
  async getLeadById(@Param('id') id: string) {
    const data = await this.leadsService.getLeadById(id);
    return { status: 200, data };
  }
}
