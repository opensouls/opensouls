import { EventName, IPCEvent } from "./worker.ts";
import type { Subprocess } from "bun";
import { logger } from "../logger.ts";

export class WorkerController {
  private childProcess?: Subprocess
  private alivePromise: Promise<void>;
  private aliveResolver: (() => void) | null = null;
  private aliveRejector: (() => void) | null = null;
  private lastAliveTime: number = 0;
  private reportingAlive: boolean = false;
  private dead: boolean = false;
  private messageHandlers: ((message: IPCEvent) => void)[];
  private aliveStartTimeoutHandle?: ReturnType<typeof setTimeout>;
  private aliveIntervalHandle?: ReturnType<typeof setInterval>;

  public workerId?: string;

  constructor(private environment?: Record<string, string>) {
    this.alivePromise = new Promise((resolve, reject) => {
      this.aliveResolver = resolve;
      this.aliveRejector = reject;
    });
    this.messageHandlers = [];
  }

  get isAlive() {
    return !!(this.reportingAlive && this.childProcess && (this.childProcess.exitCode === null));
  }

  spawn(): Promise<void> {
    logger.info("[controller] spawning worker");
    this.childProcess = Bun.spawn(["bun", "src/worker/worker.ts"], {
      ipc: this.handleMessage,
      stdout: "inherit",
      env: {
        ...this.environment,
        PGLITE_SKIP_BOOTSTRAP: "true",
      },
    });

    this.startAliveCheck();

    return this.alivePromise;
  }

  send(message: IPCEvent) {
    if (this.dead) {
      return
    }
    
    if (!this.childProcess) {
      logger.error("Error sending message to worker, no child process", { workerId: this.workerId, reportingAlive: this.reportingAlive, hasChildProcess: !!this.childProcess, alert: false });
      throw new Error("Worker is not alive");
    }

    if (!this.reportingAlive && this.aliveResolver) {
      logger.warn("Worker is not reporting alive, waiting for alive promise yet we tried to send a message", { workerId: this.workerId, alert: false, message });
      this.alivePromise.then(() => {
        this.send(message);
      }).catch((err) => {
        logger.error("Error sending message to worker, alive promise was rejected", { workerId: this.workerId, alert: false, error: err });
        this.kill("error after alive promise was rejected")
      })
      return;
    }

    try {
      this.childProcess.send(message);
    } catch (err: any) {
      logger.error("Error sending message to worker, moving to kill", { workerId: this.workerId, alert: false, error: err });
      this.kill("error sending message to worker")
      throw err;
    }
  }

  async kill(reason?: string): Promise<void> {
    if (this.dead) {
      return
    }
    this.stopAliveChecks();
    this.reportingAlive = false;
    
    // send an error message so that the server.ts will release the controller.
    this.handleMessage({
      name: EventName.workerDied,
      payload: {}
    })

    logger.warn("[controller] killing worker", { workerId: this.workerId, reason, });

    const exitedPromise = this.childProcess?.exited;

    try {
      this.send({ name: EventName.kill, payload: {} });
      // Wait up to 500ms for graceful exit, then SIGKILL
      const gracefulExit = await Promise.race([
        exitedPromise,
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 500))
      ]);
      
      if (gracefulExit === 'timeout' && this.childProcess && typeof this.childProcess.exitCode !== 'number') {
        logger.warn("kill message failed to kill client, going to sigkill", { workerId: this.workerId });
        process.kill(this.childProcess.pid, 'SIGKILL');
        await exitedPromise;
      }
    } catch (err) {
      logger.warn("kill process message send errored, going directly to SIGKILL", { workerId: this.workerId });
      // if this errors then the child process is already dead
      // let's just make sure it's gone.
      if (this.childProcess && typeof this.childProcess.exitCode !== 'number') {
        process.kill(this.childProcess.pid, 'SIGKILL');
        await exitedPromise;
      }
    } finally {
      this.messageHandlers.length = 0;

      this.dead = true;
      logger.info("worker killed", { workerId: this.workerId });

      if (this.aliveRejector) {
        this.aliveRejector();
        this.aliveResolver = null
        this.aliveRejector = null
      }
    }
  }

  waitForAlive(): Promise<void> {
    return this.alivePromise || Promise.resolve();
  }

  onMessage(handler: (message: IPCEvent) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index !== -1) {
        this.messageHandlers.splice(index, 1);
      }
    }
  }

  private stopAliveChecks() {
    if (this.aliveStartTimeoutHandle) {
      clearTimeout(this.aliveStartTimeoutHandle);
    }
    if (this.aliveIntervalHandle) {
      clearInterval(this.aliveIntervalHandle);
    }
  }

  private startAliveCheck() {
    this.aliveStartTimeoutHandle = setTimeout(() => {
      this.aliveStartTimeoutHandle = undefined;
      this.aliveIntervalHandle = setInterval(() => {
        if (Date.now() - this.lastAliveTime > 6_000) {
          this.reportingAlive = false;
          logger.warn("worker did not send alive message within 6_000ms", { workerId: this.workerId, difference: Date.now() - this.lastAliveTime });
          this.kill("alive interval exceeded");
        }
      }, 600);
    }, 2000);
  }

  // arrow function so we don't have to bind.
  private handleMessage = (message: IPCEvent) => {
    this.lastAliveTime = Date.now();
    if (this.aliveResolver) {
      logger.info("[p] worker is alive", { workerId: this.workerId });
      this.reportingAlive = true;
      this.aliveResolver();
      this.aliveResolver = null;
      this.aliveRejector = null;
    }

    if ([EventName.alive, EventName.memoryUsage].includes(message.name)) {
      if (message.name === EventName.alive) {
        this.workerId = message.payload.workerId;
      }
      return
    }

    logger.info('[parent] message received: ', { name: message.name })
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }
}
