import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcryptjs from 'bcryptjs';
import { AppException, ErrorCode } from '../common/exceptions/app.exception';
import { User } from '../user/schemas/user.schema';
import { AuthService } from './auth.service';
import { RefreshToken } from './schemas/refresh-token.schema';

describe('AuthService', () => {
  let service: AuthService;

  let userModel: { findOne: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let refreshTokenModel: { findOne: jest.Mock; create: jest.Mock; deleteOne: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    refreshTokenModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(RefreshToken.name), useValue: refreshTokenModel },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signUp', () => {
    it('should create a user and return tokens', async () => {
      userModel.findOne.mockReturnValue({ lean: () => null });
      userModel.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        name: 'Test User',
      });
      refreshTokenModel.create.mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await service.signUp({
        email: 'test@example.com',
        name: 'Test User',
        password: 'Password1!',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(userModel.create).toHaveBeenCalledTimes(1);
    });

    it('should throw AppException EMAIL_EXISTS if email is taken', async () => {
      userModel.findOne.mockReturnValue({
        lean: () => ({ _id: '507f1f77bcf86cd799439011', email: 'test@example.com' }),
      });

      await expect(
        service.signUp({ email: 'test@example.com', name: 'Test', password: 'Password1!' }),
      ).rejects.toMatchObject({ code: ErrorCode.EMAIL_EXISTS });
    });
  });

  describe('signIn', () => {
    it('should return tokens for valid credentials', async () => {
      const hashedPassword = await bcryptjs.hash('Password1!', 10);
      userModel.findOne.mockReturnValue({
        select: () => ({
          _id: '507f1f77bcf86cd799439011',
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
        }),
      });
      refreshTokenModel.create.mockResolvedValue({
        _id: '507f191e810c19729de860ea',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await service.signIn({
        email: 'test@example.com',
        password: 'Password1!',
        rememberMe: false,
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw AppException INVALID_CREDENTIALS for wrong password', async () => {
      const hashedPassword = await bcryptjs.hash('CorrectPassword1!', 10);
      userModel.findOne.mockReturnValue({
        select: () => ({
          _id: '507f1f77bcf86cd799439011',
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
        }),
      });

      await expect(
        service.signIn({ email: 'test@example.com', password: 'WrongPassword1!' }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_CREDENTIALS });
    });

    it('should throw AppException INVALID_CREDENTIALS for unknown email', async () => {
      userModel.findOne.mockReturnValue({ select: () => null });

      await expect(
        service.signIn({ email: 'no@one.com', password: 'Password1!' }),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_CREDENTIALS });
    });
  });

  describe('logout', () => {
    it('should delete the refresh token document', async () => {
      refreshTokenModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.logout('507f1f77bcf86cd799439011', 'raw-refresh-token');

      expect(refreshTokenModel.deleteOne).toHaveBeenCalledTimes(1);
    });
  });
});
