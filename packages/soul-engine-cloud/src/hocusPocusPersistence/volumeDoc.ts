import { cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { logger } from "../logger.ts";

const ROOT_DIR = join("data", "_documents");
const ABSOLUTE_ROOT_DIR = resolve(ROOT_DIR);

function getFirstTwoBytesHex(num: bigint) {
  const strings = ((num >> 48n) & 0xFFFFn).toString(16).padStart(4, '0');
  return [strings[0] + strings[1], strings[2] + strings[3]];
}

export const filePathFromDocumentName = async (documentName: string) => {  
  const [firstLevel, secondLevel] = getFirstTwoBytesHex(Bun.hash.wyhash(documentName));
  
  const fullPath = join(ROOT_DIR, firstLevel, secondLevel, documentName).toLowerCase();

  if (!resolve(fullPath).startsWith(ABSOLUTE_ROOT_DIR)) {
    logger.error("Invalid document name", { documentName, resolved: resolve(fullPath), root: ABSOLUTE_ROOT_DIR });
    throw new Error("Invalid document name");
  }

  return fullPath;
}

export const getBytesFromVolume = async (documentName: string) => {
  const fullPath = await filePathFromDocumentName(documentName);

  const file = Bun.file(fullPath)
  
  if (!(await file.exists())) {
    return null;
  }

  //@ts-ignore bun allows this but for some reason is not in the bun-types we have
  return file.bytes() as Uint8Array;
}

export const storeBytesToVolume = async (documentName: string, bytes: Uint8Array) => {
  const fullPath = await filePathFromDocumentName(documentName);

  return Bun.write(fullPath, bytes);
}

export const copyVolumeDocForVersioning = async (sourceDocName: string, targetDocName: string) => {
  const sourceFullPath = await filePathFromDocumentName(sourceDocName);
  const targetFullPath = await filePathFromDocumentName(targetDocName);

  return cp(sourceFullPath, targetFullPath);
}
