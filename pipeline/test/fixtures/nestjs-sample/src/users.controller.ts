import { Controller, Get, Post, Body, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll(): string {
    return 'all users';
  }

  @Get(':id')
  findOne(@Param('id') id: string): string {
    return `user ${id}`;
  }

  @Post()
  create(@Body() body: unknown): string {
    return 'created';
  }
}
