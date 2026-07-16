import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { RolePermissionsService } from './role-permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateRolePermissionDto } from './dto/role-permission.dto';
import { ErrorService } from '../common/error/error.service';

@Controller('role-permissions')
@UseGuards(JwtAuthGuard)
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
    private readonly errorService: ErrorService
  ) {}

  @Post()
  async updatePermissions(
    @Body() dtos: UpdateRolePermissionDto[],
    @CurrentUser() user: any
  ) {
    try {
      if (user.role !== 'admin') {
        this.errorService.errorThrower(403, { message: 'Admin access required' });
      }
      return await this.rolePermissionsService.updatePermissions(
        user.company_id || '00000000-0000-0000-0000-000000000000',
        dtos
      );
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }

  @Get()
  async getPermissions(@CurrentUser() user: any) {
    try {
      return await this.rolePermissionsService.getPermissions(
        user.company_id || '00000000-0000-0000-0000-000000000000'
      );
    } catch (error: any) {
      this.errorService.errorThrower(error.status || 500, { message: error.message, details: error });
    }
  }
}
