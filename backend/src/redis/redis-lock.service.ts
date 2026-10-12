import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from './redis.constants';

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

@Injectable()
export class RedisLockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async withLock<T>(
    key: string,
    operation: () => Promise<T>,
    ttlMilliseconds = 30000,
  ): Promise<T> {
    if (!Number.isInteger(ttlMilliseconds) || ttlMilliseconds <= 0) {
      throw new BadRequestException('Lock TTL must be a positive integer.');
    }

    const lockKey = `lock:${key}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.set(
      lockKey,
      lockToken,
      'PX',
      ttlMilliseconds,
      'NX',
    );
    if (acquired !== 'OK') {
      throw new ConflictException('This operation is already in progress.');
    }

    try {
      return await operation();
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken);
    }
  }
}
