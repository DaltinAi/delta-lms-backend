import { IsEmail, IsNotEmpty, IsString, IsIn, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({ description: 'User password', minLength: 6 })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({ description: 'User first name' })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'User last name' })
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'User role', enum: ['Telecaller', 'Receptionist', 'Counsellor', 'Admissions', 'Admin'] })
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(['Telecaller', 'Receptionist', 'Counsellor', 'Admissions', 'Admin'], {
    message: 'Role must be one of: Telecaller, Receptionist, Counsellor, Admissions, Admin',
  })
  role: string;
}
