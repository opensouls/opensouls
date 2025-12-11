import { filePathFromDocumentName } from "../src/hocusPocusPersistence/volumeDoc.ts";

const trimmedName = process.argv[2].trim();
const path = await filePathFromDocumentName(trimmedName);

console.log("path: ", path);