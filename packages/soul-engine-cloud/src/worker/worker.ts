import "ses";
import { heapStats } from "bun:jsc";
import { CognitiveEventAbsolute } from "@opensouls/engine";
import { executeDebugUserCode } from "./isolatedDebugSubroutine.js";
import { destroyWebsocket, getWorkerStatusProvider, setSharedSecret } from "./workerProvider.js";
import { doLockdown } from "../lockdown.js";
import { logger } from "../logger.js";
import { getPrismaClient } from "../prisma.js";
import { executeProductionUserCode } from "./isolatedProdSubroutine.js";
import { SerializedCognitiveEventAbsolute } from "../subroutineState.js";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import { HocuspocusProvider } from "@hocuspocus/provider";

function getCPUUsage() {
  const cpus = os.cpus();
  const totalUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    const idle = cpu.times.idle;
    return acc + (1 - idle / total);
  }, 0);
  return (totalUsage / cpus.length) * 100;
}
export const workerId = uuidv4();

let requestId = 0;

if (typeof harden === "undefined") {
  doLockdown();
}

export enum EventName {
  "alive" = "alive",
  "kill" = "kill",
  "abort" = "abort",
  "setSharedSecret" = "setSharedSecret",
  "executeDebugMainThread" = "executeDebugMainThread",
  "executeDebugSubprocesses" = "executeDebugSubprocesses",
  "executeProdMainThread" = "executeProdMainThread",
  "executeProdSubprocesses" = "executeProdSubprocesses",
  "scheduleEvent" = "scheduleEvent",
  "scheduleEventResponse" = "scheduleEventResponse",
  "cancelScheduledEvent" = "cancelScheduledEvent",
  "complete" = "complete",
  "error" = "error",
  "memoryUsage" = "memoryUsage",
  "workerDied" = "workerDied",
}

export interface ExecuteMainThreadPayload {
  codePath: string;
  documentName: string;
  context: {
    organizationId: string;
    userId: string;
    organizationSlug: string;
  };
}

export interface ExecuteSubprocessesPayload {
  invocationCount: number;
  codePath: string;
  documentName: string;
  context: {
    organizationId: string;
    userId: string;
    organizationSlug: string;
  };
}

export interface AbortPayload {
  documentName: string;
}

export interface CancelScheduledEventPayload {
  jobId: string;
}

export interface ScheduleEventPayload {
  documentName: string;
  event: SerializedCognitiveEventAbsolute;
  context: {
    organizationId: string;
    userId: string;
    organizationSlug: string;
  };
}

export interface ScheduleEventResponsePayload {
  jobId: string;
}

export type IPCEvent =
  | {
      name: EventName.executeDebugMainThread;
      payload: ExecuteMainThreadPayload;
    }
  | {
      name: EventName.executeDebugSubprocesses;
      payload: ExecuteSubprocessesPayload;
    }
  | {
      name: EventName.executeProdMainThread;
      payload: ExecuteMainThreadPayload;
    }
  | {
      name: EventName.executeProdSubprocesses;
      payload: ExecuteSubprocessesPayload;
    }
  | {
      name: EventName.abort;
      payload: AbortPayload;
    }
  | {
      name: EventName.scheduleEvent;
      requestId: number;
      payload: ScheduleEventPayload;
    }
  | {
      name: EventName.scheduleEventResponse;
      responseTo: number;
      payload: ScheduleEventResponsePayload;
    }
  | {
      name: EventName.cancelScheduledEvent;
      payload: CancelScheduledEventPayload;
    }
  | {
      name: EventName.kill;
      payload: object;
    }
  | {
      name: EventName.alive;
      payload: {
        workerId: string;
      };
    }
  | {
      name: EventName.setSharedSecret;
      payload: {
        secret: string;
      };
    }
  | {
      name: EventName.complete;
      payload: {
        documentName: string;
      };
    }
  | {
      name: EventName.error;
      payload: {
        documentName: string;
        error: any;
      };
    }
  | {
      name: EventName.memoryUsage;
      payload: {
        heapSize: number;
        objectCount: number;
        pid: number;
        workerId: string;
      };
    }
  | {
      name: EventName.workerDied;
      payload: object;
    };

const isChildProcess = () => {
  return !!process.send;
};

export const sendIpcEvent = (event: IPCEvent) => {
  if (!process.send) {
    console.error("Cannot send IPC event without parent", process);
    throw new Error("Cannot send IPC event without parent");
  }
  try {
    process.send(event);
  } catch (err) {
    logger.error("Error sending IPC event, self destruct", {
      error: err,
      workerId,
    });
    abortController.abort();
    process.exit(1);
  }
};

let cancelSendalive = () => {};

const getProcessInfo = () => {
  const stats = heapStats();

  return {
    pid: process.pid,
    heapSize: stats.heapSize,
    heapCapacity: stats.heapCapacity,
    objectCount: stats.objectCount,
    protectedObjectCount: stats.protectedObjectCount,
    extraMemorySize: stats.extraMemorySize,
    protectedGlobalObjectCount: stats.protectedGlobalObjectCount,
    workerId,
    cpu: getCPUUsage(),
  };
};

if (isChildProcess()) {
  logger.info("worker started", { workerId });

  sendIpcEvent({
    name: EventName.alive,
    payload: {
      workerId,
    },
  });

  const sendAlive = () => {
    let canceled = false;

    const internal = async () => {
      while (!canceled) {
        if (canceled) {
          break;
        }
        sendIpcEvent({
          name: EventName.alive,
          payload: {
            workerId,
          },
        });
        await Bun.sleep(300);
      }
    };

    internal();

    return () => {
      canceled = true;
    };
  };

  cancelSendalive = sendAlive();

  setInterval(() => {
    const timer = logger.startTimer();
    timer.done({ message: "worker memory usage", ...getProcessInfo() });
    // TODO: do we want this on so the parent process can kill on high memory?
    // sendIpcEvent({
    //   name: EventName.memoryUsage,
    //   payload,
    // })
  }, 60_000);

  const client = getPrismaClient(); // connect prisma too.
  client.$connect();

  logger.info("worker prisma connected", { workerId });
}

let documentName: string;
let abortController = new AbortController();

const pendingCreateScheduledEvent = new Map<number, (jobId: string) => void>();

const userCodeScheduleEventHandler = async (
  eventToSchedule: CognitiveEventAbsolute,
  context: any
) => {
  return new Promise<string>((resolve) => {
    requestId++;
    pendingCreateScheduledEvent.set(requestId, resolve);
    sendIpcEvent({
      name: EventName.scheduleEvent,
      requestId: requestId,
      payload: {
        documentName,
        event: {
          ...eventToSchedule,
          process: eventToSchedule.process.name,
          when: eventToSchedule.when.getTime(),
        },
        context,
      },
    });
  });
};

let workerStatusProvider: HocuspocusProvider | null = null;

process.on("message", async (event: IPCEvent) => {
  logger.info("[w] received event: ", { event: event.name, workerId });
  switch (event.name) {
    case EventName.setSharedSecret:
      logger.info("[w] setting shared secret", { workerId });
      setSharedSecret(event.payload.secret);
      workerStatusProvider = getWorkerStatusProvider();
      break;
    case EventName.abort:
      if (event.payload.documentName === documentName) {
        logger.info("[w] aborting", {
          documentName: event.payload.documentName,
          workerId,
        });
        abortController.abort();
      }
      break;
    case EventName.scheduleEventResponse: {
      const resolve = pendingCreateScheduledEvent.get(event.responseTo);
      if (resolve) {
        resolve(event.payload.jobId);
        pendingCreateScheduledEvent.delete(event.responseTo);
      }
      break;
    }
    case EventName.executeDebugMainThread:
      logger.info("[w] executeDebugMainThread received", {
        documentName: event.payload.documentName,
        workerId,
      });

      documentName = event.payload.documentName;
      abortController = new AbortController();

      try {
        await executeDebugUserCode({
          kind: "main",
          codePath: event.payload.codePath,
          documentName: event.payload.documentName,
          context: event.payload.context,
          abortSignal: abortController.signal,
          scheduleEvent: (userScheduledEvent: CognitiveEventAbsolute) =>
            userCodeScheduleEventHandler(
              userScheduledEvent,
              event.payload.context
            ),
        });
        logger.info("[w] worker complete", {
          documentName: event.payload.documentName,
          workerId,
        });
        sendIpcEvent({
          name: EventName.complete,
          payload: {
            documentName,
          },
        });
      } catch (err: any) {
        logger.error("[w] Error executing main thread", {
          error: err,
          alert: false,
          workerId,
        });
        sendIpcEvent({
          name: EventName.error,
          payload: {
            documentName,
            error: err.message ?? err.toString() ?? "Unknown error",
          },
        });
      } finally {
        documentName = "";
      }

      break;

    case EventName.executeDebugSubprocesses:
      logger.info("[w] executeDebugSubprocesses received", {
        documentName: event.payload.documentName,
        workerId,
      });

      documentName = event.payload.documentName;
      abortController = new AbortController();

      try {
        await executeDebugUserCode({
          kind: "subprocess",
          expectedInvocationCount: event.payload.invocationCount,

          codePath: event.payload.codePath,
          documentName: event.payload.documentName,
          context: event.payload.context,
          abortSignal: abortController.signal,
          scheduleEvent: (userScheduledEvent: CognitiveEventAbsolute) =>
            userCodeScheduleEventHandler(
              userScheduledEvent,
              event.payload.context
            ),
        });
        sendIpcEvent({
          name: EventName.complete,
          payload: {
            documentName,
          },
        });
      } catch (err: any) {
        logger.error("[w] Error executing main thread", {
          error: err,
          alert: false,
          workerId,
        });
        sendIpcEvent({
          name: EventName.error,
          payload: {
            documentName,
            error: err.message ?? err.toString() ?? "Unknown error",
          },
        });
      } finally {
        documentName = "";
      }

      break;

    case EventName.executeProdMainThread:
      logger.info("[w] executeProdMainThread received", {
        documentName: event.payload.documentName,
        workerId,
      });

      documentName = event.payload.documentName;
      abortController = new AbortController();

      try {
        await executeProductionUserCode({
          kind: "main",
          codePath: event.payload.codePath,
          documentName: event.payload.documentName,
          context: event.payload.context,
          abortSignal: abortController.signal,
          scheduleEvent: (userScheduledEvent: CognitiveEventAbsolute) =>
            userCodeScheduleEventHandler(
              userScheduledEvent,
              event.payload.context
            ),
        });
        sendIpcEvent({
          name: EventName.complete,
          payload: {
            documentName,
          },
        });
      } catch (err: any) {
        logger.error("[w] Error executing main thread", {
          error: err,
          alert: false,
          workerId,
        });
        sendIpcEvent({
          name: EventName.error,
          payload: {
            documentName,
            error: err.message ?? err.toString() ?? "Unknown error",
          },
        });
      } finally {
        documentName = "";
      }

      break;

    case EventName.executeProdSubprocesses:
      logger.info(EventName.executeProdSubprocesses, {
        documentName: event.payload.documentName,
        workerId,
      });

      documentName = event.payload.documentName;
      abortController = new AbortController();

      try {
        await executeProductionUserCode({
          kind: "subprocess",
          expectedInvocationCount: event.payload.invocationCount,

          codePath: event.payload.codePath,
          documentName: event.payload.documentName,
          context: event.payload.context,
          abortSignal: abortController.signal,
          scheduleEvent: (userScheduledEvent: CognitiveEventAbsolute) =>
            userCodeScheduleEventHandler(
              userScheduledEvent,
              event.payload.context
            ),
        });
        sendIpcEvent({
          name: EventName.complete,
          payload: {
            documentName,
          },
        });
      } catch (err: any) {
        logger.error("[w] Error executing main thread", {
          error: err,
          alert: false,
          workerId,
        });
        sendIpcEvent({
          name: EventName.error,
          payload: {
            documentName,
            error: err.message ?? err.toString() ?? "Unknown error",
          },
        });
      } finally {
        documentName = "";
      }

      break;

    case EventName.kill:
      logger.warn("[w] kill event received", { workerId });
      cancelSendalive();
      workerStatusProvider?.destroy();
      workerStatusProvider = null;
      destroyWebsocket();
      abortController.abort();
      await getPrismaClient().$disconnect();
      process.exit(0);
  }
});

process.on("exit", (code) => {
  if (workerStatusProvider) {
    workerStatusProvider.destroy();
  }
  destroyWebsocket();
  logger.info(`Worker exiting`, { exitCode: code, ...getProcessInfo() });
});
