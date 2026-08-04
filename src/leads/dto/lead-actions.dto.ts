import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReassignLeadsDto {
  @ApiProperty({ description: 'Array of lead IDs to reassign', type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty()
  leadIds: string[];

  @ApiProperty({ description: 'User ID of the new assignee' })
  @IsUUID()
  @IsNotEmpty()
  toAssigneeId: string;
}

export class UpdateLeadStageDto {
  @ApiProperty({ description: 'ID or name of the new stage' })
  @IsString()
  @IsNotEmpty()
  toStageId: string;

  @ApiPropertyOptional({ description: 'Optional remark for the stage change' })
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiPropertyOptional({
    description: 'Mandatory sub-status for Interested/Cold counsellor stages',
  })
  @IsString()
  @IsOptional()
  subStatus?: string;

  @ApiPropertyOptional({
    description: 'Counsellor ID assigned during walk-in flow',
  })
  @IsUUID()
  @IsOptional()
  counselorId?: string;

  @ApiPropertyOptional({
    description: 'Optional metadata associated with the stage transition',
    type: Object,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
