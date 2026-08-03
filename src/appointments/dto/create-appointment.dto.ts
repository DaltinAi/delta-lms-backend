import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'ID of the lead' })
  @IsUUID()
  @IsNotEmpty()
  leadId: string;

  @ApiProperty({ description: 'ID of the current stage of the lead' })
  @IsUUID()
  @IsNotEmpty()
  currentStageId: string;

  @ApiProperty({ description: 'Appointment date in YYYY-MM-DD format' })
  @IsDateString()
  @IsNotEmpty()
  appointmentDate: string;

  @ApiProperty({ description: 'Appointment time in HH:MM format' })
  @IsString()
  @IsNotEmpty()
  appointmentTime: string;

  @ApiPropertyOptional({ description: 'Optional remark for the appointment' })
  @IsString()
  @IsOptional()
  remark?: string;
}
