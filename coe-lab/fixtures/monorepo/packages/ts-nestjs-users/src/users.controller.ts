/**
 * Lab fixture — NestJS-style users controller.
 * Decorators mirror NestJS so CodeGraph native route typing can engage.
 */

@Controller('users')
export class UsersController {
  @Get()
  listUsers() {
    return [];
  }

  @Get(':id')
  getUser() {
    return {};
  }

  @Post()
  createUser() {
    return {};
  }
}

// Ambient decorator stubs so the file is valid TS without @nestjs/* install
function Controller(_path?: string): ClassDecorator {
  return () => undefined;
}
function Get(_path?: string): MethodDecorator {
  return () => undefined;
}
function Post(_path?: string): MethodDecorator {
  return () => undefined;
}
