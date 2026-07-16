import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ErrorService } from '../common/error/error.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly errorService: ErrorService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    try {
      if (!user || !user.userId) {
        this.errorService.errorThrower(401, {
          message: 'User not authenticated',
        });
      }
      const profile = await this.usersService.getProfile(user.userId);
      if (!profile) {
        this.errorService.errorThrower(404, {
          message: 'User profile not found',
        });
      }
      return profile;
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get('active-telecallers')
  async getActiveTelecallers() {
    try {
      const telecallers = await this.usersService.getActiveTelecallers();
      return { status: 200, data: telecallers };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      const user = await this.usersService.getUserById(id);
      if (!user) {
        this.errorService.errorThrower(404, {
          message: `User with ID ${id} not found`,
        });
      }
      return { status: 200, data: user };
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, {
        message: error.message,
        details: error,
      });
    }
  }
}
