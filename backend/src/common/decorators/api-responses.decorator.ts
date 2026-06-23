import { HttpStatus, applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ERROR_DEFINITIONS, ErrorCode } from '../exceptions/app.exception';

/**
 * Attaches Swagger @ApiResponse decorators derived from ERROR_DEFINITIONS.
 * Always includes the 400 validation-error response.
 * Pass the ErrorCode values that this endpoint can throw.
 */
export function ApiAppResponses(...codes: ErrorCode[]) {
  return applyDecorators(
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation failed',
    }),
    ...codes.map((code) => {
      const { status, message } = ERROR_DEFINITIONS[code];
      return ApiResponse({ status, description: message });
    }),
  );
}
