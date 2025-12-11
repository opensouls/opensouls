import { WorkerController } from './controller.ts';
import { logger } from '../logger.ts';
import { EventName, IPCEvent } from './worker.ts';

type WaitingResolver = (worker: WorkerController) => void;

export class WorkerPool {
  private static readonly MAX_POOL_SIZE = 5;
  private static readonly MIN_POOL_SIZE = 2;

  private available = new Map<string, WorkerController>();
  private inUse = new Map<string, WorkerController>();
  private waiting: WaitingResolver[] = [];
  private creating = 0;
  private draining = false;
  private spawnPromises = new Set<Promise<WorkerController>>();

  constructor(private sharedSecret: string, readonly port: number) { }

  start() {
    if (this.draining) {
      logger.warn("attempted to start worker pool while draining");
      return;
    }
    logger.info("launching worker pool, will connect on port", { port: this.port });
    for (let i = 0; i < WorkerPool.MIN_POOL_SIZE; i++) {
      this.spawnAndStore().catch((error) => {
        logger.error("error pre-spawning worker", { error });
      });
    }
  }

  async getWorker(): Promise<WorkerController> {
    if (this.draining) {
      throw new Error("Cannot get worker while pool is draining");
    }
    
    const existing = this.takeAvailable();
    if (existing) {
      return existing;
    }

    if (this.totalWorkers() < WorkerPool.MAX_POOL_SIZE) {
      const worker = await this.spawnAndStore();
      this.inUse.set(worker.workerId!, worker);
      return worker;
    }

    return new Promise<WorkerController>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  releaseWorker(worker: WorkerController): void {
    const id = worker.workerId;
    if (!id || !this.inUse.has(id)) {
      logger.warn("attempted to release worker not in use", { workerId: id });
      return;
    }

    this.inUse.delete(id);

    if (this.draining) {
      // Don't respawn or reuse workers during drain
      worker.kill("draining");
      return;
    }

    if (!worker.isAlive) {
      logger.warn("released worker was dead, respawning replacement", { workerId: id });
      worker.kill("released dead");
      this.spawnAndMaybeDispatch();
      return;
    }

    const resolver = this.waiting.shift();
    if (resolver) {
      this.inUse.set(id, worker);
      resolver(worker);
      return;
    }

    this.available.set(id, worker);
  }

  async drainWorkerPool(): Promise<void> {
    logger.info("draining worker pool");
    this.draining = true;
    
    // Reject any waiting promises
    for (const resolver of this.waiting) {
      try {
        resolver(null as any); // will cause error in caller
      } catch {
        // ignore
      }
    }
    this.waiting.length = 0;
    
    // Wait for any in-progress spawns to complete, then kill them
    logger.info("waiting for in-progress worker spawns", { count: this.spawnPromises.size });
    const spawningWorkers = await Promise.allSettled(this.spawnPromises);
    const workersFromSpawns = spawningWorkers
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<WorkerController>).value);
    
    this.spawnPromises.clear();
    
    const workers = [
      ...this.available.values(),
      ...this.inUse.values(),
      ...workersFromSpawns
    ];
    
    logger.info("killing workers", { count: workers.length });
    const killPromises = workers.map(async (worker) => {
      try {
        await worker.kill("drain");
      } catch (error) {
        logger.error("error killing worker during drain", { error, workerId: worker.workerId });
      }
    });
    await Promise.all(killPromises);
    this.available.clear();
    this.inUse.clear();
  }

  broadcast(message: IPCEvent): void {
    for (const worker of [...this.available.values(), ...this.inUse.values()]) {
      try {
        worker.send(message);
      } catch (error) {
        logger.error("error broadcasting message to worker", { error, workerId: worker.workerId });
      }
    }
  }

  private async spawnAndStore(): Promise<WorkerController> {
    if (this.draining) {
      throw new Error("Cannot spawn worker while pool is draining");
    }
    
    this.creating += 1;
    
    const performSpawn = async (): Promise<WorkerController> => {
      try {
        const controller = await this.createWorker();
        if (!controller.workerId) {
          throw new Error("workerId missing after spawn");
        }
        
        if (this.draining) {
          // Draining started while we were creating, kill immediately
          controller.kill("draining during spawn");
          throw new Error("Pool draining during worker spawn");
        }
        
        this.available.set(controller.workerId, controller);
        this.dispatchWaitingIfNeeded();
        return controller;
      } finally {
        this.creating -= 1;
        this.spawnPromises.delete(spawnPromise);
      }
    };
    
    const spawnPromise = performSpawn();
    this.spawnPromises.add(spawnPromise);
    return spawnPromise;
  }

  private takeAvailable(): WorkerController | undefined {
    const iterator = this.available.entries().next();
    if (iterator.done) return undefined;
    const [id, worker] = iterator.value;
    this.available.delete(id);
    this.inUse.set(id, worker);
    return worker;
  }

  private async createWorker(): Promise<WorkerController> {
    logger.info("creating a new worker");
    const controller = new WorkerController({
      ...process.env,
      DEBUG_SERVER_PORT: (this.port - 1).toString(10),
    });
    await controller.spawn();
    await controller.waitForAlive();
    logger.info("controller is alive", { workerId: controller.workerId });
    controller.send({
      name: EventName.setSharedSecret,
      payload: { secret: this.sharedSecret },
    });
    return controller;
  }

  private dispatchWaitingIfNeeded() {
    if (this.waiting.length === 0) {
      return;
    }
    const worker = this.takeAvailable();
    if (worker) {
      const resolver = this.waiting.shift();
      if (resolver) {
        resolver(worker);
      } else {
        // no resolver, return worker to available
        this.available.set(worker.workerId!, worker);
      }
    }
  }

  private spawnAndMaybeDispatch() {
    if (this.draining) {
      return;
    }
    if (this.totalWorkers() >= WorkerPool.MAX_POOL_SIZE) {
      return;
    }
    this.spawnAndStore().catch((error) => {
      logger.error("error spawning replacement worker", { error });
    });
  }

  private totalWorkers() {
    return this.available.size + this.inUse.size + this.creating;
  }
}
