import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({ example: 'Password1!' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
