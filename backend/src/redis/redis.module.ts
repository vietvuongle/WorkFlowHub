import { AllConfigType } from '@/config/config.type';
import { Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { RedisLockService } from './redis-lock.service';
import { REDIS_CLIENT } from './redis.constants';
const logger = new Logger('RedisLockClient');

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const tlsEnabled = configService.get('redis.tlsEnabled', {
          infer: true,
        });
        const options: RedisOptions = {
          host: configService.getOrThrow('redis.host', { infer: true }),
          port: configService.getOrThrow('redis.port', { infer: true }),
          password: configService.get('redis.password', { infer: true }),
          tls: tlsEnabled ? {} : undefined,
        };
        const redis = new Redis(options);
        redis.on('error', (error) => {
          logger.error('Redis lock client error', error.stack);
        });
        return redis;
      },
    },
    RedisLockService,
  ],
  exports: [RedisLockService],
})
export class RedisLockModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
