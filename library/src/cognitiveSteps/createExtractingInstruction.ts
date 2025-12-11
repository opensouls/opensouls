import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, z } from "@opensouls/engine";

/**
 * createExtractingInstruction is similar to instructions, but it will always extract the passed in
 * schema.
 * 
 * @example
 * const extractUsername = createExtractingInstruction(
 *  z.object({
 *   username: z.string().describe("The username of the person")
 *  })
 * );
 * 
 * const [withUsername, username] = await extractUsername(
 *  workingMemory,
 *  "Analyze the text and extract the username"),
 *  { model: "gpt-4o" },
 * )
 */

export const createExtractingInstruction = <T extends z.ZodRawShape>(params: z.ZodObject<T>) => {
  return createCognitiveStep((instructions: string) => {
    return {
      schema: params,
      command: ({ soulName }: WorkingMemory) => {
        return {
          role: ChatMessageRoleEnum.System,
          name: soulName,
          content: instructions,
        };
      }
    }
  });
}

export default createExtractingInstruction
