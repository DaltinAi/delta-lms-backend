import { IsString, IsNotEmpty, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVisitDto {
  @ApiProperty({ description: 'ID of the lead' })
  @IsUUID()
  @IsNotEmpty()
  leadId: string;

  @ApiProperty({ description: 'Date and time of the visit' })
  @IsDateString()
  @IsNotEmpty()
  visitDate: string;

  @ApiPropertyOptional({ description: 'Notes regarding the visit' })
  @IsString()
  @IsOptional()
  notes?: string;
}
