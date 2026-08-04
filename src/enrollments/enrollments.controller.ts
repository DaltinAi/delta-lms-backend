import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post(':leadId')
  async enrollLead(
    @Param('leadId') leadId: string,
    @Body() enrollmentData: any,
    @CurrentUser() user: any,
  ) {
    if (user.role.toLowerCase() !== 'counsellor' && user.role.toLowerCase() !== 'admin') {
      throw new ForbiddenException('Only counsellors and admins can enroll leads');
    }

    try {
      const enrollment = await this.enrollmentsService.enrollLead(
        leadId,
        user.company_id || '00000000-0000-0000-0000-000000000000',
        user.userId,
        enrollmentData,
      );
      return { status: 201, message: 'Lead enrolled successfully', data: enrollment };
    } catch (error: any) {
      throw error;
    }
  }
}
