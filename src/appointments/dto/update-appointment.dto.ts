import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'Appointment date in YYYY-MM-DD format' })
  @IsDateString()
  @IsOptional()
  appointmentDate?: string;

  @ApiPropertyOptional({ description: 'Appointment time in HH:MM format' })
  @IsString()
  @IsOptional()
  appointmentTime?: string;

  @ApiPropertyOptional({ description: 'Optional remark for the appointment' })
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiPropertyOptional({
    description: 'Status of the appointment',
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  })
  @IsIn(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  @IsOptional()
  status?: string;
}
