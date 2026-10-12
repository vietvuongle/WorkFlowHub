import { verifyPassword } from '@/utils/password.util';
import { getQueueToken } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

jest.mock('@/utils/password.util', () => ({
  verifyPassword: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let configServiceValue: Partial<Record<keyof ConfigService, jest.Mock>>;
  let jwtServiceValue: Partial<Record<keyof JwtService, jest.Mock>>;
  let userRepositoryValue: Partial<
    Record<keyof Repository<UserEntity>, jest.Mock>
  >;
  let emailQueueValue: { add: jest.Mock };
  let userServiceValue: { resetPassword: jest.Mock };
  let cacheManagerValue: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    store: { get: jest.Mock };
  };

  beforeAll(async () => {
    configServiceValue = {
      get: jest.fn(),
    };

    jwtServiceValue = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    userRepositoryValue = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    emailQueueValue = { add: jest.fn() };
    userServiceValue = { resetPassword: jest.fn() };
    cacheManagerValue = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      store: { get: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: configServiceValue,
        },
        {
          provide: JwtService,
          useValue: jwtServiceValue,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepositoryValue,
        },
        {
          provide: getQueueToken('email'),
          useValue: emailQueueValue,
        },
        { provide: UserService, useValue: userServiceValue },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerValue,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects sign-in when the password is valid but email is unverified', async () => {
    userRepositoryValue.findOne!.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      password: 'hashed-password',
      isEmailVerified: false,
    });
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    await expect(
      service.signIn({
        email: 'user@example.com',
        password: 'plain-password',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks a user verified only with the active token stored in cache', async () => {
    const user = {
      id: 'user-id',
      isEmailVerified: false,
    };
    jwtServiceValue.verify!.mockReturnValue({ id: user.id });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('confirm-secret');
    cacheManagerValue.get.mockResolvedValue('verification-token');
    userRepositoryValue.findOne!.mockResolvedValue(user);
    userRepositoryValue.save!.mockResolvedValue(user);

    await service.verifyEmail('verification-token');

    expect(user.isEmailVerified).toBe(true);
    expect(userRepositoryValue.save).toHaveBeenCalledWith(user);
    expect(cacheManagerValue.del).toHaveBeenCalledWith(
      'auth:token:user-id:email-verification',
    );
  });

  it('rejects a verification token that is not the active cached token', async () => {
    jwtServiceValue.verify!.mockReturnValue({ id: 'user-id' });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('confirm-secret');
    cacheManagerValue.get.mockResolvedValue('newer-token');
    userRepositoryValue.findOne!.mockResolvedValue({
      id: 'user-id',
      isEmailVerified: false,
    });

    await expect(service.verifyEmail('older-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userRepositoryValue.save).not.toHaveBeenCalled();
  });

  it('blocks access tokens when the account email is not verified', async () => {
    jwtServiceValue.verify!.mockReturnValue({
      id: 'user-id',
      sessionId: 'session-id',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('access-secret');
    cacheManagerValue.store.get.mockResolvedValue(false);
    userRepositoryValue.findOne!.mockResolvedValue({
      id: 'user-id',
      isEmailVerified: false,
    });

    await expect(
      service.verifyAccessToken('access-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resends verification to unverified users without revealing account existence', async () => {
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      isEmailVerified: false,
    };
    userRepositoryValue.findOne!.mockResolvedValue(user);
    configServiceValue.getOrThrow = jest.fn((key: string) =>
      key === 'auth.confirmEmailExpires' ? '1d' : 'confirm-secret',
    );
    jwtServiceValue.signAsync!.mockResolvedValue('new-verification-token');

    const result = await service.resendEmailVerification(user.email);

    expect(result.message).toContain('If an unverified account exists');
    expect(cacheManagerValue.set).toHaveBeenCalledWith(
      'auth:token:user-id:email-verification',
      'new-verification-token',
      86400000,
    );
    expect(emailQueueValue.add).toHaveBeenCalled();
  });

  it('sends password reset instructions without revealing account existence', async () => {
    userRepositoryValue.findOne!.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      isEmailVerified: true,
    });
    configServiceValue.getOrThrow = jest.fn((key: string) =>
      key === 'auth.forgotExpires' ? '15m' : 'forgot-secret',
    );
    jwtServiceValue.signAsync!.mockResolvedValue('password-reset-token');

    const result = await service.forgotPassword('user@example.com');

    expect(result.message).toContain('If a verified account exists');
    expect(cacheManagerValue.set).toHaveBeenCalledWith(
      'auth:token:user-id:password',
      'password-reset-token',
      900000,
    );
    expect(emailQueueValue.add).toHaveBeenCalledWith(
      'password-reset',
      { email: 'user@example.com', token: 'password-reset-token' },
      expect.any(Object),
    );
  });

  it('does not send reset mail for an unverified account', async () => {
    userRepositoryValue.findOne!.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      isEmailVerified: false,
    });

    const result = await service.forgotPassword('user@example.com');

    expect(result.message).toContain('If a verified account exists');
    expect(emailQueueValue.add).not.toHaveBeenCalled();
  });

  it('validates the active reset token', async () => {
    jwtServiceValue.verify!.mockReturnValue({ id: 'user-id' });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('forgot-secret');
    cacheManagerValue.get.mockResolvedValue('password-reset-token');
    userRepositoryValue.findOne!.mockResolvedValue({ id: 'user-id' });

    await expect(
      service.verifyForgotPassword('password-reset-token'),
    ).resolves.toEqual({ valid: true });
  });

  it('rejects a reset token that is no longer active', async () => {
    jwtServiceValue.verify!.mockReturnValue({ id: 'user-id' });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('forgot-secret');
    cacheManagerValue.get.mockResolvedValue('newer-token');
    userRepositoryValue.findOne!.mockResolvedValue({ id: 'user-id' });

    await expect(
      service.verifyForgotPassword('older-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resets the password once and consumes the reset token', async () => {
    jwtServiceValue.verify!.mockReturnValue({ id: 'user-id' });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('forgot-secret');
    cacheManagerValue.get.mockResolvedValue('password-reset-token');
    userRepositoryValue.findOne!.mockResolvedValue({ id: 'user-id' });

    const result = await service.resetPassword(
      'password-reset-token',
      'NewPassword123!',
    );

    expect(userServiceValue.resetPassword).toHaveBeenCalledWith(
      'user-id',
      'NewPassword123!',
    );
    expect(cacheManagerValue.del).toHaveBeenCalledWith(
      'auth:token:user-id:password',
    );
    expect(result.message).toContain('Password has been reset');
  });

  it('rejects expired or malformed password reset JWTs', async () => {
    jwtServiceValue.verify!.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    configServiceValue.getOrThrow = jest.fn().mockReturnValue('forgot-secret');

    await expect(
      service.verifyForgotPassword('expired-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
