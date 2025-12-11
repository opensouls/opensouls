import { isObject } from "./isObject.ts"

// we use JSON here instead of structured clone because the synced store objects
// don't behave well with structured clone.
export const deepCopy = <T>(obj: T): T => {
  if (!isObject(obj)) {
    return obj
  }

  return JSON.parse(JSON.stringify(obj))
}