import {
  encode
} from 'gpt-tokenizer/model/gpt-4'; // Keep in sync with embedding tokenizer expectations
import { logger } from '../../logger.ts';

export const splitIntoChunks = (content:string, tokenCount: number) => {
  const chunks: string[] = []
  const splitIntoWords = content.split(" ")
  let buffer = ""
  while (splitIntoWords.length > 0) {
    const word = splitIntoWords.shift()
    if (!word) {
      continue
    }
    if (encode(buffer + " " + word).length > Math.floor(tokenCount * 0.85)) {
      if (buffer.length === 0) {
        logger.warn("word is too long to embed", { word })
        // a bit inelegant but handle the case where the word is too long to embed,
        // so instead we split it in half and add it to the beginning of the array
        // Add the split parts back to the beginning of the array
        const splitIndex = Math.floor(word.length / 2);
        const firstHalf = word.slice(0, splitIndex);
        const secondHalf = word.slice(splitIndex);
        splitIntoWords.unshift(firstHalf, secondHalf);
      }

      chunks.push(buffer)
      buffer = word
      continue
    }
    // otherwise just buffer it
    buffer = buffer + " " + word
  }
  if (buffer.length > 0) {
    chunks.push(buffer)
  }

  return chunks
}
