import { IsEmail, IsNotEmpty, IsString, IsIn, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstName: string;

  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  lastName: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(['Telecaller', 'Receptionist', 'Counsellor', 'Admissions', 'Admin'], {
    message: 'Role must be one of: Telecaller, Receptionist, Counsellor, Admissions, Admin',
  })
  role: string;
}
