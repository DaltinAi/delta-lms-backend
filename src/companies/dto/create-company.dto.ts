import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Name of the company' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ description: 'Subdomain for the company' })
  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @ApiProperty({ description: 'Email of the company admin' })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @ApiPropertyOptional({ description: 'Password of the company admin', minLength: 6 })
  @IsString()
  @IsOptional()
  @MinLength(6)
  adminPassword?: string;

  @ApiPropertyOptional({ description: 'First name of the company admin' })
  @IsString()
  @IsOptional()
  adminFirstName?: string;

  @ApiPropertyOptional({ description: 'Last name of the company admin' })
  @IsString()
  @IsOptional()
  adminLastName?: string;
}
