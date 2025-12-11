import { randomUUID } from "node:crypto";
import { logger } from "../logger.ts";

interface TaskSpec {
  jobKey?: string;
  queueName?: string;
  maxAttempts?: number;
  runAt?: Date | string | number;
}

export interface JobHelpers {
  job: {
    id: string;
    attempts: number;
  };
}

interface TaskWorkerOpts {
  tasks: Record<string, (payload: any, helpers?: any) => Promise<any>>;
  workerSchema?: string; // kept for API compatibility; unused in in-memory mode
}

type JobState = "pending" | "running" | "completed" | "failed" | "canceled";

interface QueuedJob {
  id: string;
  name: string;
  payload: any;
  spec: TaskSpec;
  attempts: number;
  state: JobState;
  queueName: string;
  timer?: Timer;
}

type Timer = ReturnType<typeof setTimeout>;

export class TaskWorker {
  private tasks: TaskWorkerOpts["tasks"];
  private readonly concurrency = 20;
  private running = false;
  private activeCount = 0;

  private jobKeyIndex = new Map<string, string>();
  private jobs = new Map<string, QueuedJob>();
  private queue = new Map<string, string[]>(); // queueName -> jobIds
  private activeQueues = new Set<string>(); // queueName currently executing

  constructor({ tasks }: TaskWorkerOpts) {
    this.tasks = tasks;
  }

  public async run() {
    this.running = true;
    logger.info("in-memory task runner started");
    this.drain();
  }

  public async stop() {
    this.running = false;
    this.jobs.forEach((job) => {
      if (job.timer) clearTimeout(job.timer);
    });
    this.jobs.clear();
    this.queue.clear();
    this.activeQueues.clear();
    this.jobKeyIndex.clear();
    logger.info("in-memory task runner stopped");
  }

  public async removeJob(...jobIds: string[]) {
    for (const jobId of jobIds) {
      const job = this.jobs.get(jobId);
      if (!job) continue;
      if (job.timer) {
        clearTimeout(job.timer);
      } else {
        this.dequeue(job.queueName, jobId);
      }
      job.state = "canceled";
      if (job.spec.jobKey) {
        this.jobKeyIndex.delete(job.spec.jobKey);
      }
      this.jobs.delete(jobId);
    }
  }

  public async addJob(name: string, payload: any, spec: TaskSpec = {}) {
    const existingId = spec.jobKey ? this.jobKeyIndex.get(spec.jobKey) : undefined;
    if (existingId) {
      const existingJob = this.jobs.get(existingId);
      if (existingJob && existingJob.state === "pending") {
        logger.info("deduplicating job by jobKey", { jobKey: spec.jobKey, existingId });
        return { id: existingId };
      }
    }

    const id = randomUUID();
    const queueName = spec.queueName || "default";
    const job: QueuedJob = {
      id,
      name,
      payload,
      spec,
      attempts: 0,
      state: "pending",
      queueName,
    };

    this.jobs.set(id, job);
    if (spec.jobKey) {
      this.jobKeyIndex.set(spec.jobKey, id);
    }

    if (spec.runAt) {
      const delay = Math.max(0, new Date(spec.runAt).getTime() - Date.now());
      job.timer = setTimeout(() => {
        job.timer = undefined;
        this.enqueue(queueName, id);
        this.drain();
      }, delay);
    } else {
      this.enqueue(queueName, id);
    }

    this.drain();

    return { id };
  }

  private enqueue(queueName: string, jobId: string) {
    if (!this.queue.has(queueName)) {
      this.queue.set(queueName, []);
    }
    this.queue.get(queueName)!.push(jobId);
  }

  private dequeue(queueName: string, jobId: string) {
    const q = this.queue.get(queueName);
    if (!q) return;
    const idx = q.indexOf(jobId);
    if (idx >= 0) {
      q.splice(idx, 1);
    }
  }

  private drain() {
    if (!this.running) return;

    while (this.activeCount < this.concurrency) {
      const next = this.nextRunnableJob();
      if (!next) break;
      this.execute(next);
    }
  }

  private nextRunnableJob(): QueuedJob | undefined {
    for (const [queueName, jobIds] of this.queue.entries()) {
      if (jobIds.length === 0) continue;
      if (this.activeQueues.has(queueName)) continue;

      const jobId = jobIds.shift()!;
      const job = this.jobs.get(jobId);
      if (!job || job.state !== "pending") continue;

      this.activeQueues.add(queueName);
      return job;
    }

    return undefined;
  }

  private async execute(job: QueuedJob) {
    const taskFn = this.tasks[job.name];
    if (!taskFn) {
      logger.error("unknown task", { task: job.name, alert: false });
      this.finishJob(job, "failed");
      return;
    }

    this.activeCount += 1;
    job.state = "running";
    job.attempts += 1;

    const helpers: JobHelpers = {
      job: {
        id: job.id,
        attempts: job.attempts,
      },
    };

    try {
      await taskFn(job.payload, helpers);
      this.finishJob(job, "completed");
    } catch (err) {
      logger.error("task execution failed", { task: job.name, jobId: job.id, attempts: job.attempts, error: err, alert: false });

      const maxAttempts = job.spec.maxAttempts ?? 1;
      if (job.attempts < maxAttempts) {
        const backoffMs = Math.min(5000, 250 * job.attempts);
        job.state = "pending";
        job.timer = setTimeout(() => {
          job.timer = undefined;
          this.enqueue(job.queueName, job.id);
          this.drain();
        }, backoffMs);
      } else {
        this.finishJob(job, "failed");
      }
    } finally {
      this.activeCount -= 1;
      this.activeQueues.delete(job.queueName);
      this.drain();
    }
  }

  private finishJob(job: QueuedJob, state: JobState) {
    job.state = state;
    if (job.spec.jobKey) {
      this.jobKeyIndex.delete(job.spec.jobKey);
    }
    this.jobs.delete(job.id);
  }
}
