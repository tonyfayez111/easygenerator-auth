import { HttpException, HttpStatus } from '@nestjs/common';

export enum ErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
}

export const ERROR_DEFINITIONS: Record<
  ErrorCode,
  { status: HttpStatus; message: string }
> = {
  [ErrorCode.INVALID_CREDENTIALS]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid credentials',
  },
  [ErrorCode.EMAIL_EXISTS]: {
    status: HttpStatus.CONFLICT,
    message: 'An account with this email already exists',
  },
  [ErrorCode.USER_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'User not found',
  },
  [ErrorCode.INVALID_REFRESH_TOKEN]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid or expired refresh token',
  },
};

export class AppException extends HttpException {
  constructor(public readonly code: ErrorCode) {
    const { status, message } = ERROR_DEFINITIONS[code];
    super({ code, message }, status);
  }
}
