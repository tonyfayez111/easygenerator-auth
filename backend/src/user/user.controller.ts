import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiAppResponses } from '../common/decorators/api-responses.decorator';
import { ErrorCode } from '../common/exceptions/app.exception';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Req() req: Request) {
    const user = req.user as {
      _id: { toString(): string };
      email: string;
      name: string;
    };
    return { id: user._id.toString(), email: user.email, name: user.name };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiAppResponses(ErrorCode.USER_NOT_FOUND)
  getById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}
