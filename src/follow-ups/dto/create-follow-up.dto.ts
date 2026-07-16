import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFollowUpDto {
  @ApiProperty({ description: 'ID of the lead' })
  @IsUUID()
  @IsNotEmpty()
  leadId: string;

  @ApiProperty({ description: 'Scheduled date and time for the follow-up' })
  @IsDateString()
  @IsNotEmpty()
  scheduledFor: string;

  @ApiProperty({ description: 'Mode of the follow-up (e.g., call, email, meeting)' })
  @IsString()
  @IsNotEmpty()
  mode: string;

  @ApiPropertyOptional({ description: 'Additional notes for the follow-up' })
  @IsString()
  @IsOptional()
  note?: string;
}
