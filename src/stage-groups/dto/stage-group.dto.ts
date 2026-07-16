import { IsString, IsNotEmpty, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStageGroupDto {
  @ApiProperty({ description: 'Name of the stage group' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the stage group' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Array of stage IDs in this group', type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  stage_ids?: string[];
}
