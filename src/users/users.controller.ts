import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('active-telecallers')
  async getActiveTelecallers() {
    const telecallers = await this.usersService.getActiveTelecallers();
    return { status: 200, data: telecallers };
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.getUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { status: 200, data: user };
  }
}
