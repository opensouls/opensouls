import { Json } from "@opensouls/engine";
import { SubroutineState } from "./subroutineState.ts";
import { v4 as uuidv4 } from "uuid";
import { observeDeep } from "./forked-synced-store/index.ts";
import { EventLog } from "./eventLog.ts";
import { logger } from "./logger.ts";
import { SuccessfulJsonRPCResponse } from "@opensouls/core";
import { deepCopy } from "./lib/deepCopy.ts";

export interface ExecuteOpts {
  timeout?: number;
  signal?: AbortSignal;
}

const TOOL_CALL_ABORTED = {
  code: -2,
  message: "Tool call aborted",
}

function isSuccessfulJsonRPCResponse(response: any): response is SuccessfulJsonRPCResponse {
  return !response.error && ('result' in response);
}

export class ToolHandler {
  constructor(private eventLog: EventLog) { }


  /**
   * on execute we watch for changes to the pendingToolCalls, we then add a unique request ID to the pendingToolCalls with the request. We wait for either abort, timeout, or response,
  * if any of those events happen, we return the responses/error to the awaiting caller, and cleanup the event listeners and delete the request from the pendingToolCalls
  */
  async execute<ResponseType = Json, RequestType = Json>(toolName: string, params: RequestType, opts: ExecuteOpts = { timeout: 30_000, signal: new AbortController().signal }): Promise<ResponseType> {
    logger.info(`Executing tool ${toolName}`)
    const id = uuidv4()
    if (opts.signal?.aborted) {
      return Promise.reject(TOOL_CALL_ABORTED)
    }

    return new Promise<ResponseType>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        logger.info('tool call timed out')
        stopObserving();
        opts.signal?.removeEventListener("abort", onAborted);
        reject({
          code: -1,
          message: "Tool call timed out",
        });
        delete this.eventLog.pendingToolCalls?.[id];
      }, opts.timeout);

      const onAborted = () => {
        logger.info('tool call aborted')
        opts.signal?.removeEventListener("abort", onAborted);
        clearTimeout(timeoutId);
        stopObserving();
        reject({
          code: -2,
          message: "Tool call aborted",
        });
        delete this.eventLog.pendingToolCalls?.[id];
      }

      if (opts.signal) {
        opts.signal.addEventListener("abort", onAborted);
      }

      const stopObserving = observeDeep(this.eventLog.pendingToolCalls, () => {
        const response = this.eventLog.pendingToolCalls?.[id].response;
        if (!response) {
          return
        }
        
        clearTimeout(timeoutId);
        opts.signal?.removeEventListener("abort", onAborted);
        stopObserving();

        if (opts.signal?.aborted) {
          reject(TOOL_CALL_ABORTED);
        }

        if (isSuccessfulJsonRPCResponse(response)) {
          logger.info("resolving tool call")
          resolve(deepCopy(response.result) as any);
        } else {
          logger.info("rejecting tool call")
          reject(deepCopy(response.error));
        }
        delete this.eventLog.pendingToolCalls[id];
      });

      this.eventLog.pendingToolCalls[id] = {
        request: {
          id,
          method: toolName,
          params,
        },
      };

    })
  }
}
