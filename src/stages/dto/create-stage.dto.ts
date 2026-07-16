import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStageDto {
  @ApiProperty({ description: 'Unique key for the stage' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Display name of the stage' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Order of the stage' })
  @IsNumber()
  @IsOptional()
  sort_order?: number;

  @ApiPropertyOptional({ description: 'Whether the stage is active' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Type of the stage (e.g., positive, negative, neutral)' })
  @IsString()
  @IsOptional()
  stage_type?: string;
}
