import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    const hitKey = `throttler:${throttlerName}:${key}:hits`;
    const blockKey = `throttler:${throttlerName}:${key}:blocked`;

    const totalHits = await this.redis.incr(hitKey);

    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }

    const ttlMs = await this.redis.pttl(hitKey);

    let isBlocked = false;
    let timeToBlockExpire = 0;

    const existingBlockTtl = await this.redis.pttl(blockKey);
    if (existingBlockTtl > 0) {
      isBlocked = true;
      timeToBlockExpire = Math.ceil(existingBlockTtl / 1000);
    } else if (totalHits > limit) {
      if (blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        isBlocked = true;
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      } else {
        isBlocked = true;
        timeToBlockExpire = Math.ceil(Math.max(ttlMs, 0) / 1000);
      }
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(Math.max(ttlMs, 0) / 1000),
      isBlocked,
      timeToBlockExpire,
    };
  }

  async onApplicationShutdown() {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
