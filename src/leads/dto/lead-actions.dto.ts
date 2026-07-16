import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
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
  @ApiProperty({ description: 'ID of the new stage' })
  @IsUUID()
  @IsNotEmpty()
  toStageId: string;

  @ApiPropertyOptional({ description: 'Optional remark for the stage change' })
  @IsString()
  @IsOptional()
  remark?: string;
}
