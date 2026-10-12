import { AllConfigType } from '@/config/config.type';
import { CacheKey } from '@/constants/cache.constant';
import { createCacheKey } from '@/utils/cache.util';
import { verifyPassword } from '@/utils/password.util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';
import { UserService } from './user.service';

jest.mock('@/utils/password.util', () => ({
  verifyPassword: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let userRepositoryValue: Partial<
    Record<keyof Repository<UserEntity>, jest.Mock>
  >;
  let sessionRepositoryValue: Partial<
    Record<keyof Repository<SessionEntity>, jest.Mock>
  >;
  let configServiceValue: Partial<
    Record<keyof ConfigService<AllConfigType>, jest.Mock>
  >;
  let cacheManagerValue: {
    del: jest.Mock;
    store: { set: jest.Mock };
  };

  beforeAll(async () => {
    userRepositoryValue = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    sessionRepositoryValue = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    configServiceValue = {
      getOrThrow: jest.fn().mockReturnValue('1h'),
    };
    cacheManagerValue = {
      del: jest.fn(),
      store: { set: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepositoryValue,
        },
        {
          provide: getRepositoryToken(SessionEntity),
          useValue: sessionRepositoryValue,
        },
        { provide: ConfigService, useValue: configServiceValue },
        { provide: CACHE_MANAGER, useValue: cacheManagerValue },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('changes a password and revokes the user sessions', async () => {
    const user = { id: 'user-id', password: 'hashed-password' } as UserEntity;
    userRepositoryValue.findOne!.mockResolvedValue(user);
    userRepositoryValue.save!.mockResolvedValue(user);
    sessionRepositoryValue.find!.mockResolvedValue([
      { id: 'session-id', createdAt: new Date(Date.now() - 1000) },
    ]);
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    await service.changePassword(
      'user-id' as UserEntity['id'],
      'CurrentPassword123!',
      'NewPassword123!',
    );

    expect(user.password).toBe('NewPassword123!');
    expect(userRepositoryValue.save).toHaveBeenCalledWith(user);
    expect(cacheManagerValue.store.set).toHaveBeenCalledWith(
      createCacheKey(CacheKey.SESSION_BLACKLIST, 'session-id'),
      true,
      expect.any(Number),
    );
    expect(sessionRepositoryValue.delete).toHaveBeenCalledWith({
      userId: 'user-id',
    });
    expect(cacheManagerValue.del).toHaveBeenCalledWith(
      createCacheKey(CacheKey.PASSWORD_RESET, 'user-id'),
    );
  });

  it('rejects a password change when the current password is incorrect', async () => {
    userRepositoryValue.findOne!.mockResolvedValue({
      id: 'user-id',
      password: 'hashed-password',
    });
    (verifyPassword as jest.Mock).mockResolvedValue(false);

    await expect(
      service.changePassword(
        'user-id' as UserEntity['id'],
        'wrong-password',
        'NewPassword123!',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(userRepositoryValue.save).not.toHaveBeenCalled();
  });

  it('resets a password and deletes all refresh sessions', async () => {
    const user = { id: 'user-id', password: 'old-password' } as UserEntity;
    userRepositoryValue.findOne!.mockResolvedValue(user);
    userRepositoryValue.save!.mockResolvedValue(user);
    sessionRepositoryValue.find!.mockResolvedValue([]);

    await service.resetPassword(
      'user-id' as UserEntity['id'],
      'NewPassword123!',
    );

    expect(userRepositoryValue.save).toHaveBeenCalledWith(user);
    expect(sessionRepositoryValue.delete).toHaveBeenCalledWith({
      userId: 'user-id',
    });
  });
});
