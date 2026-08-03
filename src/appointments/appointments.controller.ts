import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorService } from '../common/error/error.service';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly errorService: ErrorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an appointment (Telecaller)' })
  async create(
    @Req() req: any,
    @Body() createAppointmentDto: CreateAppointmentDto,
  ) {
    try {
      const user = req.user;
      const appointment = await this.appointmentsService.create(
        user.company_id,
        user.userId,
        createAppointmentDto,
      );
      return {
        status: 201,
        message: 'Appointment created successfully',
        data: appointment,
      };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all appointments' })
  async findAll(
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('tab') tab?: string,
    @Query('branch') branch?: string,
  ) {
    try {
      const user = req.user;
      const appointmentsData = await this.appointmentsService.findAll(
        user.company_id,
        limit ? +limit : 10,
        offset ? +offset : 0,
        tab,
        branch,
      );
      return { status: 200, ...appointmentsData };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific appointment' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    try {
      const user = req.user;
      const appointment = await this.appointmentsService.findOne(
        id,
        user.company_id,
      );
      return { status: 200, data: appointment };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an appointment (Receptionist)' })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    try {
      const user = req.user;
      const appointment = await this.appointmentsService.update(
        id,
        user.company_id,
        user.id,
        updateAppointmentDto,
      );
      return {
        status: 200,
        message: 'Appointment updated successfully',
        data: appointment,
      };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete an appointment' })
  async remove(@Req() req: any, @Param('id') id: string) {
    try {
      const user = req.user;
      const result = await this.appointmentsService.remove(id, user.company_id);
      return { status: 200, ...result };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
