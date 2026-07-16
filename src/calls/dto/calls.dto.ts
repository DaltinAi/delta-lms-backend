import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BaseCallQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination' })
  @IsString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ description: 'Limit per page' })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Filter by call status' })
  @IsString()
  @IsOptional()
  filterStatus?: string;

  @ApiPropertyOptional({ description: 'Start date for filtering calls' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering calls' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class CallsByAgentDto extends BaseCallQueryDto {
  @ApiPropertyOptional({ description: 'Agent ID to filter by' })
  @IsString()
  @IsOptional()
  agentId?: string;
}

export class CallsByLeadDto extends BaseCallQueryDto {
  @ApiProperty({ description: 'Lead ID to fetch calls for' })
  @IsString()
  @IsNotEmpty()
  leadId: string;
}
