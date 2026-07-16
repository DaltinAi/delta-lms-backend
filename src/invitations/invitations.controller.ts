import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly errorService: ErrorService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createInvitation(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: any
  ) {
    try {
      return await this.invitationsService.createInvitation(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        user.userId,
        dto
      );
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Post('accept')
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    try {
      return await this.invitationsService.acceptInvitation(dto);
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getPendingInvitations(@CurrentUser() user: any) {
    try {
      return await this.invitationsService.getPendingInvitations(
        user.company_id || '00000000-0000-0000-0000-000000000000'
      );
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }
}
