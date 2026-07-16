import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRolePermissionDto {
  @ApiProperty({ description: 'Role name' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'Stage ID' })
  @IsUUID()
  @IsNotEmpty()
  stage_id: string;

  @ApiPropertyOptional({ description: 'Whether the role can view this stage' })
  @IsBoolean()
  @IsOptional()
  can_view?: boolean;

  @ApiPropertyOptional({ description: 'Whether the role can move leads to this stage' })
  @IsBoolean()
  @IsOptional()
  can_move_to?: boolean;
}
