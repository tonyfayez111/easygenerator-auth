import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { AppException, ErrorCode } from '../common/exceptions/app.exception';
import { User, UserDocument } from '../user/schemas/user.schema';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    const existing = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .lean();
    if (existing) throw new AppException(ErrorCode.EMAIL_EXISTS);

    const passwordHash = await bcryptjs.hash(dto.password, 10);
    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      password: passwordHash,
    });

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken();
    await this.saveRefreshToken(user.id, refreshToken, true);

    return { accessToken, refreshToken };
  }

  async signIn(dto: SignInDto) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+password');

    const isValid =
      user && (await bcryptjs.compare(dto.password, user.password));
    if (!isValid) throw new AppException(ErrorCode.INVALID_CREDENTIALS);

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken();
    await this.saveRefreshToken(user.id, refreshToken, dto.rememberMe ?? false);

    return { accessToken, refreshToken, rememberMe: dto.rememberMe ?? false };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.refreshTokenModel.findOne({
      tokenHash,
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppException(ErrorCode.INVALID_REFRESH_TOKEN);
    }

    const userId = stored.userId.toString();
    await this.refreshTokenModel.deleteOne({ _id: stored._id });

    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new AppException(ErrorCode.INVALID_CREDENTIALS);

    const accessToken = this.signAccessToken(user._id.toString(), user.email);
    const newRefreshToken = this.generateRefreshToken();

    const rememberMe =
      stored.expiresAt.getTime() - Date.now() > 24 * 60 * 60 * 1000;
    await this.saveRefreshToken(
      user._id.toString(),
      newRefreshToken,
      rememberMe,
    );

    return { accessToken, refreshToken: newRefreshToken, rememberMe };
  }

  async logout(userId: string, rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenModel.deleteOne({
      userId: new Types.ObjectId(userId),
      tokenHash,
    });
  }

  private signAccessToken(userId: string, email: string) {
    return this.jwtService.sign({ sub: userId, email });
  }

  private generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async saveRefreshToken(
    userId: string,
    rawToken: string,
    rememberMe: boolean,
  ) {
    // Remember Me: 7 days
    // No Remember Me: 1 hour (session-based, user must login again after browser closes)
    const expirationMs = rememberMe
      ? 7 * 24 * 60 * 60 * 1000 // 7 days
      : 60 * 60 * 1000; // 1 hour

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + expirationMs),
    });
  }
}
