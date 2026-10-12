import { ConflictException } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisLockService } from './redis-lock.service';

describe('RedisLockService', () => {
  let redis: {
    set: jest.Mock;
    eval: jest.Mock;
  };
  let service: RedisLockService;

  beforeEach(() => {
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    service = new RedisLockService(redis as unknown as Redis);
  });

  it('runs the operation and releases only its own lock', async () => {
    const operation = jest.fn().mockResolvedValue('done');

    await expect(
      service.withLock('project:task-sequence', operation, 5000),
    ).resolves.toBe('done');

    expect(redis.set).toHaveBeenCalledWith(
      'lock:project:task-sequence',
      expect.any(String),
      'PX',
      5000,
      'NX',
    );
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get", KEYS[1])'),
      1,
      'lock:project:task-sequence',
      expect.any(String),
    );
  });

  it('rejects work when another process already owns the lock', async () => {
    redis.set.mockResolvedValue(null);

    await expect(
      service.withLock('project:task-sequence', jest.fn()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('releases the lock when the protected operation fails', async () => {
    const operationError = new Error('operation failed');
    const operation = jest.fn().mockRejectedValue(operationError);

    await expect(service.withLock('resource', operation)).rejects.toBe(
      operationError,
    );
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });
});
