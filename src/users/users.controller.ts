import { Controller, Get, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('by-role')
  async getUsersByRole(@Query('role') role: string) {
    try {
      if (!role) {
        this.errorService.errorThrower(400, {
          message: 'role query parameter is required',
        });
      }
      const users = await this.usersService.getUsersByRole(role);
      return { status: 200, data: users };
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        this.errorService.errorThrower(400, {
          message: `Invalid UUID format: ${id}`,
        });
      }
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
