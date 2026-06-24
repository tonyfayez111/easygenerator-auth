import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiAppResponses } from '../common/decorators/api-responses.decorator';
import { ErrorCode } from '../common/exceptions/app.exception';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshGuard } from './guards/refresh.guard';

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string, rememberMe: boolean) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
    ...(rememberMe ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiAppResponses(ErrorCode.EMAIL_EXISTS)
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.signUp(dto);
    setRefreshCookie(res, refreshToken, true);
    return { access_token: accessToken };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive tokens' })
  @ApiAppResponses(ErrorCode.INVALID_CREDENTIALS)
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, rememberMe } =
      await this.authService.signIn(dto);
    setRefreshCookie(res, refreshToken, rememberMe);
    return { access_token: accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshGuard)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  @ApiAppResponses(ErrorCode.INVALID_REFRESH_TOKEN)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken } = req.user as { refreshToken: string };
    const {
      accessToken,
      refreshToken: newRefreshToken,
      rememberMe,
    } = await this.authService.refresh(refreshToken);
    setRefreshCookie(res, newRefreshToken, rememberMe);
    return { access_token: accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token and clear cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as { _id: string };
    const rawToken = (req.cookies as Record<string, string | undefined>)[
      REFRESH_COOKIE
    ];
    if (rawToken) await this.authService.logout(user._id.toString(), rawToken);
    clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }
}
