import { backOff } from 'exponential-backoff';
import { logger } from '../logger.ts';

interface PoolOptions<T> {
  create: () => Promise<T>;
  destroy?: (item: T) => Promise<void> | void;
  validate?: (item: T) => Promise<boolean> | boolean;
  min?: number;
  max?: number;
}

class Pool<T> {
  available: T[] = [];
  inUse: Set<T> = new Set();
  private waitingClients: ((item: T) => void)[] = [];
  private creating: number = 0;
  private options: Required<PoolOptions<T>>;

  constructor(options: PoolOptions<T>) {
    this.options = {
      destroy: () => {},
      validate: () => Promise.resolve(true),
      min: 1,
      max: 10,
      ...options,
    };
    this.initialize();
  }

  private async initialize() {
    for (let i = 0; i < this.options.min; i++) {
      this.createObject();
    }
  }

  private async createObject(): Promise<void>{
    this.creating++;
    try {
      await backOff(async () => {
        const item = await this.options.create();
        if (!(await this.options.validate(item))) {
          throw new Error('created invalid object');
        }
        this.possiblyGiveWaitingClientAnItem(item);
      }, {
        numOfAttempts: 4,
        retry: (e, i) => {
          logger.error('Error creating object in pool', { error: e, attempt: i });
          return i < 4;
        },
      })
    } catch (error) {
      throw error
    } finally {
      this.creating--;
    }
  }

  async acquire(): Promise<T> {
    if (this.available.length > 0) {
      const item = this.available.shift();
      if (!item) {
        return this.acquire();
      }
      if (!(await this.options.validate(item))) {
        await this.options.destroy(item);
        return this.acquire();
      }
      this.inUse.add(item);
      return item;
    }

    if (this.inUse.size + this.creating < this.options.max) {
      this.createObject();
    } else {
      logger.warn("pool request was forced to wait.")
    }

    return new Promise((resolve) => {
      this.waitingClients.push(resolve);
    });
  }

  async release(item: T) {
    if (!this.inUse.has(item)) {
      logger.error("pool error, item not marked in use", { alert: true });
      throw new Error('This item is not part of the pool or is not currently in use');
    }

    this.inUse.delete(item);

    if (await this.options.validate(item)) {
      logger.info("pool item is valid, returning to pool", { workerId: (item as any)['workerId'] });
      this.possiblyGiveWaitingClientAnItem(item);
    } else {
      try {
        await this.options.destroy(item);
      } catch (err) {
        logger.error("error destroying invalid item", { error: err });
      }
      this.createObject();
    }
  }

  async drain() {
    logger.info("draining pool");

    for (const item of this.inUse) {
      try {
        await this.options.destroy(item);
      } catch (err) {
        logger.error("error destroying in use item", { error: err });
      }
    }
    for (const item of this.available) {
      try {
        await this.options.destroy(item);
      } catch (err) {
        logger.error("error destroying in use item", { error: err });
      }
    }
    this.inUse.clear();
    this.available = [];
  }

  get size() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      creating: this.creating,
    };
  }

  get allItems(): T[] {
    return [...this.available, ...Array.from(this.inUse)];
  }

  private possiblyGiveWaitingClientAnItem(item: T) {
    if (this.waitingClients.length > 0) {
      const resolve = this.waitingClients.shift()!;
      this.inUse.add(item);
      logger.info("returning pool item to waiting client", { workerId: (item as any)['workerId'] });
      resolve(item);
    } else {
      logger.info("returning pool item to available", { workerId: (item as any)['workerId'] });
      this.available.push(item);
    }
  }
}

export { Pool, PoolOptions };
