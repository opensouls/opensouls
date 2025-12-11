import awsLite, { type AwsLiteClient } from '@aws-lite/client'
import { backOff } from 'exponential-backoff';
import { logger } from '../logger.ts';

const BUCKET_NAME = process.env.TIGRIS_BUCKET_NAME

let tigris: AwsLiteClient;
const getTigrisClient = async () => {
  if (!tigris) {
    tigris = await awsLite({
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      region: 'auto',
      // @ts-expect-error - this says it doesn't have types, when in fact it does
      plugins: [import('@aws-lite/s3')]
    })
  }

  return tigris.S3;
}

export const rejectIn = (ms: number) => {
  let resolve: () => void
  let timeoutId: ReturnType<typeof setTimeout>
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    resolve?.()
  }

  const promise = new Promise<void>((res, reject) => {
    resolve = res
    timeoutId = setTimeout(() => reject(new Error("timeout")), ms)
  })

  return [promise, cancel] as [Promise<void>, () => void]
}

export const saveBytesToTigris = async (documentName: string, state: Uint8Array) => {
  if (!BUCKET_NAME) {
    logger.debug?.("Skipping tigris save, TIGRIS_BUCKET_NAME not set", { documentName })
    return
  }
  const tigris = await getTigrisClient()
  const timer = logger.startTimer()
  const result = backOff(async () => {
    const [timeoutPromise, cancelTimeout] = rejectIn(10_000)

    try {
      await Promise.race([
        timeoutPromise,
        tigris.PutObject({
          Bucket: BUCKET_NAME!,
          Key: documentName,
          Body: Buffer.from(state),
        })
      ])
      console.log(`Document ${documentName} stored successfully.`);
    } catch (error) {
      console.error(`Error storing tigris document ${documentName}:`, error);
    } finally {
      cancelTimeout()
    }
  }, {
    numOfAttempts: 8,
    startingDelay: 200,
    maxDelay: 1_000,
    retry: (e, i) => {
      console.error('(BACKOFF RETRY) Error storing tigris document', e, i)
      return i < 8
    }
  })

  result.finally(() => {
    timer.done({ message: "saveBytesToTigris", documentName, byteLength: state.byteLength })
  })

  return result
}

export const copyTigrisDocForVersioning = async (sourceDocName: string, targetDocName: string) => {
  if (!BUCKET_NAME) {
    logger.debug?.("Skipping tigris copy, TIGRIS_BUCKET_NAME not set", { sourceDocName, targetDocName })
    return
  }
  const tigris = await getTigrisClient()
  const timer = logger.startTimer()

  const result = backOff(async () => {
    const [timeoutPromise, cancelTimeout] = rejectIn(10_000)
    try {
      await Promise.race([
        timeoutPromise,
        tigris.CopyObject({
          Bucket: BUCKET_NAME!,
          Key: targetDocName,
          CopySource: `${BUCKET_NAME}/${sourceDocName}`,
        })
      ]);

      console.log(`Document ${sourceDocName} copied to ${targetDocName} successfully.`);
    } catch (error) {
      console.error(`Error copying document from ${sourceDocName} to ${targetDocName}:`, error);
      throw error; // Rethrow to trigger backoff
    } finally {
      cancelTimeout();
    }
  }, {
    numOfAttempts: 8,
    startingDelay: 200,
    maxDelay: 1_000,
    retry: (e, i) => {
      console.error('(BACKOFF RETRY) Error copying document', e, i);
      return i < 8;
    }
  })

  result.finally(() => {
    timer.done({ message: "copyTigrisDocForVersioning", sourceDocName, targetDocName })
  })

  return result
}

export const getBytesFromTigris = async (documentName: string) => {
  const Key = documentName;
  logger.info('getBytes', BUCKET_NAME, Key)
  const tigris = await getTigrisClient()
  const timer = logger.startTimer()

  const result = backOff(async () => {

    const [timeoutPromise, cancelTimeout] = rejectIn(10_000)

    try {
      console.log('sending command', BUCKET_NAME, Key)
      if (!BUCKET_NAME) {
        throw new Error('BUCKET_NAME not set')
      }
      const response = await Promise.race([
        tigris.GetObject({
          Bucket: BUCKET_NAME,
          Key,
        }),
        timeoutPromise,
      ]);

      console.log("response: ", response)

      if (response?.Body) {
        const toByteArray = async () => {
          if (!response.Body) {
            return null;
          }

          if (!(response.Body as any)[Symbol.asyncIterator]) {
            return response.Body as unknown as Uint8Array
          }

          const chunks: Uint8Array[] = [];
          for await (const chunk of response.Body as any) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks)
        }

        console.log('getBytes connected, begin streaming bytes', response.ContentLength, Key)
        const streamResponse = await Promise.race([
          toByteArray(),
          new Promise<Uint8Array>((_, reject) => setTimeout(() => reject(new Error("streaming timeout: " + Key)), 10_000)),
        ]);
        console.log("getBytes streaming finished", documentName, "bytes", Key);
        return streamResponse;
      } else {
        console.error("response body is empty", documentName, Key);
        throw new Error('Response body is empty');
      }
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        console.warn(`Document ${documentName} not found in bucket. Returning null`, Key);

        return null

      } else {
        console.error(`Error fetching document ${documentName}:`, error, Key);
        throw error;
      }
    } finally {
      cancelTimeout()
    }
  }, {
    numOfAttempts: 8,
    startingDelay: 200,
    maxDelay: 1000,
    retry: (e, i) => {
      console.error('(BACKOFF RETRY) Error fetching document', e, i)
      return i < 8
    }
  })

  result.finally(() => {
    timer.done({ message: "getBytesFromTigris", documentName })
  })

  return result
}
