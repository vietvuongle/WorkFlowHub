import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;
  private publisher!: Redis;
  private subscriber!: Redis;

  constructor(
    app: INestApplication,
    private readonly corsOrigin: ServerOptions['cors'] extends infer T
      ? T extends { origin?: infer O }
        ? O
        : never
      : never,
  ) {
    super(app);
  }

  async connectToRedis(options: RedisOptions): Promise<void> {
    this.publisher = new Redis(options);
    this.subscriber = this.publisher.duplicate();
    await Promise.all([this.publisher.ping(), this.subscriber.ping()]);
    this.adapterConstructor = createAdapter(this.publisher, this.subscriber);
  }

  createIOServer(
    port: number,
    options?: ServerOptions,
  ): ReturnType<IoAdapter['createIOServer']> {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: this.corsOrigin,
        credentials: true,
      },
    });
    server.adapter(this.adapterConstructor);
    return server;
  }

  async dispose(): Promise<void> {
    if (this.publisher && this.subscriber) {
      await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
    }
    await super.dispose();
  }
}
