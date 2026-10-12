import {
  IEmailJob,
  IPasswordResetJob,
  IVerifyEmailJob,
} from '@/common/interfaces/job.interface';
import { Uuid } from '@/common/types/common.type';
import { Branded } from '@/common/types/types';
import { AllConfigType } from '@/config/config.type';
import { SYSTEM_USER_ID } from '@/constants/app.constant';
import { CacheKey } from '@/constants/cache.constant';
import { ErrorCode } from '@/constants/error-code.constant';
import { JobName, QueueName } from '@/constants/job.constant';
import { ValidationException } from '@/exceptions/validation.exception';
import { createCacheKey } from '@/utils/cache.util';
import { verifyPassword } from '@/utils/password.util';
import { InjectQueue } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import crypto from 'crypto';
import ms from 'ms';
import { Repository } from 'typeorm';
import { SessionEntity } from '../user/entities/session.entity';
import { UserEntity } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { LoginReqDto } from './dto/login.req.dto';
import { LoginResDto } from './dto/login.res.dto';
import { PasswordActionResDto } from './dto/password-action.res.dto';
import { RefreshReqDto } from './dto/refresh.req.dto';
import { RefreshResDto } from './dto/refresh.res.dto';
import { RegisterReqDto } from './dto/register.req.dto';
import { RegisterResDto } from './dto/register.res.dto';
import { ResendEmailVerificationResDto } from './dto/resend-email-verification.res.dto';
import { VerifyForgotPasswordResDto } from './dto/verify-forgot-password.res.dto';
import { JwtPayloadType } from './types/jwt-payload.type';
import { JwtRefreshPayloadType } from './types/jwt-refresh-payload.type';

type Token = Branded<
  {
    accessToken: string;
    refreshToken: string;
    tokenExpires: number;
  },
  'token'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly userService: UserService,
    @InjectQueue(QueueName.EMAIL)
    private readonly emailQueue: Queue<IEmailJob, any, string>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Sign in user
   * @param dto LoginReqDto
   * @returns LoginResDto
   */
  async signIn(dto: LoginReqDto): Promise<LoginResDto> {
    const { email, password } = dto;
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'isEmailVerified'],
    });

    const isPasswordValid =
      user && (await verifyPassword(password, user.password));

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Verify your email before signing in');
    }

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = new SessionEntity({
      hash,
      userId: user.id,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });
    await session.save();

    const token = await this.createToken({
      id: user.id,
      sessionId: session.id,
      hash,
    });

    return plainToInstance(LoginResDto, {
      userId: user.id,
      ...token,
    });
  }

  async register(dto: RegisterReqDto): Promise<RegisterResDto> {
    // Check if the user already exists
    const isExistUser = await UserEntity.exists({
      where: { email: dto.email },
    });

    if (isExistUser) {
      throw new ValidationException(ErrorCode.E003);
    }

    // Register user
    const user = new UserEntity({
      email: dto.email,
      password: dto.password,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });

    await user.save();

    await this.sendVerificationEmail(user);

    return plainToInstance(RegisterResDto, {
      userId: user.id,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    let payload: { id: Uuid };
    try {
      payload = this.jwtService.verify<{ id: Uuid }>(token, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      select: ['id', 'isEmailVerified'],
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }
    if (user.isEmailVerified) {
      return;
    }

    const cacheKey = createCacheKey(CacheKey.EMAIL_VERIFICATION, user.id);
    const storedToken = await this.cacheManager.get<string>(cacheKey);
    if (!storedToken || storedToken !== token) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    await this.userRepository.save(user);
    await this.cacheManager.del(cacheKey);
  }

  async resendEmailVerification(
    email: string,
  ): Promise<ResendEmailVerificationResDto> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'isEmailVerified'],
    });
    if (user && !user.isEmailVerified) {
      await this.sendVerificationEmail(user);
    }

    return {
      message:
        'If an unverified account exists for this email, a verification message has been sent.',
    };
  }

  async forgotPassword(email: string): Promise<PasswordActionResDto> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'isEmailVerified'],
    });

    if (user?.isEmailVerified) {
      const expiresIn = this.configService.getOrThrow('auth.forgotExpires', {
        infer: true,
      });
      const token = await this.jwtService.signAsync(
        { id: user.id },
        {
          secret: this.configService.getOrThrow('auth.forgotSecret', {
            infer: true,
          }),
          expiresIn,
        },
      );

      await this.cacheManager.set(
        createCacheKey(CacheKey.PASSWORD_RESET, user.id),
        token,
        ms(expiresIn),
      );
      await this.emailQueue.add(
        JobName.PASSWORD_RESET,
        { email: user.email, token } as IPasswordResetJob,
        { attempts: 3, backoff: { type: 'exponential', delay: 60000 } },
      );
    }

    return plainToInstance(PasswordActionResDto, {
      message:
        'If a verified account exists for this email, password reset instructions have been sent.',
    });
  }

  async verifyForgotPassword(
    token: string,
  ): Promise<VerifyForgotPasswordResDto> {
    await this.getPasswordResetUserId(token);
    return plainToInstance(VerifyForgotPasswordResDto, { valid: true });
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<PasswordActionResDto> {
    const userId = await this.getPasswordResetUserId(token);
    await this.userService.resetPassword(userId, password);
    await this.cacheManager.del(
      createCacheKey(CacheKey.PASSWORD_RESET, userId),
    );

    return plainToInstance(PasswordActionResDto, {
      message: 'Password has been reset. Sign in with your new password.',
    });
  }

  async logout(userToken: JwtPayloadType): Promise<void> {
    await this.cacheManager.store.set<boolean>(
      createCacheKey(CacheKey.SESSION_BLACKLIST, userToken.sessionId),
      true,
      userToken.exp * 1000 - Date.now(),
    );
    await SessionEntity.delete(userToken.sessionId);
  }

  async refreshToken(dto: RefreshReqDto): Promise<RefreshResDto> {
    const { sessionId, hash } = this.verifyRefreshToken(dto.refreshToken);
    const session = await SessionEntity.findOneBy({ id: sessionId });

    if (!session || session.hash !== hash) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOne({
      where: { id: session.userId },
      select: ['id', 'isEmailVerified'],
    });
    if (!user?.isEmailVerified) {
      throw new UnauthorizedException();
    }

    const newHash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    await SessionEntity.update(session.id, { hash: newHash });

    return await this.createToken({
      id: user.id,
      sessionId: session.id,
      hash: newHash,
    });
  }

  async verifyAccessToken(token: string): Promise<JwtPayloadType> {
    let payload: JwtPayloadType;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('auth.secret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException();
    }

    // Force logout if the session is in the blacklist
    const isSessionBlacklisted = await this.cacheManager.store.get<boolean>(
      createCacheKey(CacheKey.SESSION_BLACKLIST, payload.sessionId),
    );

    if (isSessionBlacklisted) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.id as Uuid },
      select: ['id', 'isEmailVerified'],
    });
    if (!user?.isEmailVerified) {
      throw new UnauthorizedException();
    }

    return payload;
  }

  private verifyRefreshToken(token: string): JwtRefreshPayloadType {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('auth.refreshSecret', {
          infer: true,
        }),
      });
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async createVerificationToken(data: { id: string }): Promise<string> {
    return await this.jwtService.signAsync(
      {
        id: data.id,
      },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );
  }

  private async getPasswordResetUserId(token: string): Promise<Uuid> {
    let payload: { id: Uuid };
    try {
      payload = this.jwtService.verify<{ id: Uuid }>(token, {
        secret: this.configService.getOrThrow('auth.forgotSecret', {
          infer: true,
        }),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    if (!payload?.id) {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    const cacheKey = createCacheKey(CacheKey.PASSWORD_RESET, payload.id);
    const [storedToken, user] = await Promise.all([
      this.cacheManager.get<string>(cacheKey),
      this.userRepository.findOne({
        where: { id: payload.id },
        select: ['id'],
      }),
    ]);
    if (!user || storedToken !== token) {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    return user.id;
  }

  private async sendVerificationEmail(
    user: Pick<UserEntity, 'id' | 'email'>,
  ): Promise<void> {
    const token = await this.createVerificationToken({ id: user.id });
    const tokenExpiresIn = this.configService.getOrThrow(
      'auth.confirmEmailExpires',
      {
        infer: true,
      },
    );
    await this.cacheManager.set(
      createCacheKey(CacheKey.EMAIL_VERIFICATION, user.id),
      token,
      ms(tokenExpiresIn),
    );
    await this.emailQueue.add(
      JobName.EMAIL_VERIFICATION,
      {
        email: user.email,
        token,
      } as IVerifyEmailJob,
      { attempts: 3, backoff: { type: 'exponential', delay: 60000 } },
    );
  }

  private async createToken(data: {
    id: string;
    sessionId: string;
    hash: string;
  }): Promise<Token> {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });
    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [accessToken, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: '', // TODO: add role
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenExpires,
    } as Token;
  }
}
