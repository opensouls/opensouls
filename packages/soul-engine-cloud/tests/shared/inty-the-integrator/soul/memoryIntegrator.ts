import { ChatMessageRoleEnum, InputMemory, MentalProcess, Perception, WorkingMemory } from "@opensouls/engine"

// TODO: these types are copy/pasta from soul-engine until we upgrade.

interface Soul {
  name: string
  /**
   * attributes of the soul (previously the environment varaibles)
   */
  attributes?: Record<string, any>
  /**
   * string memories of the soul (previously this would be the {soulName}.md file)
   */
  staticMemories: Record<string, string>
}

type MemoryIntegratorParamaters = {
  perception: Perception,
  currentProcess: MentalProcess<any>,
  workingMemory: WorkingMemory
  soul: Soul
}

type MemoryIntegratorReturnTypes<PropType = any> = undefined | [WorkingMemory] | [WorkingMemory, MentalProcess<PropType>] | [WorkingMemory, MentalProcess<PropType>, PropType]
type MemoryIntegrator = <PropType>(params: MemoryIntegratorParamaters) => Promise<MemoryIntegratorReturnTypes<PropType>> | MemoryIntegratorReturnTypes<PropType>

function safeName(name?: string) {
  return (name || "").replace(/[^a-zA-Z0-9_-{}]/g, '_').slice(0, 62);
}

const memoryIntegrator: MemoryIntegrator = async ({ perception, currentProcess, workingMemory, soul }) => {

  workingMemory = workingMemory.withRegion("core", {
    role: ChatMessageRoleEnum.System,
    content: soul.staticMemories.core,
  }).withRegionalOrder("core")

  const content = `${perception.name} ${perception.action}: "${perception.content}"`

  const memory: InputMemory = {
    role: perception.internal ? ChatMessageRoleEnum.Assistant : ChatMessageRoleEnum.User,
    content,
    ...(perception.name ? { name: safeName(perception.name) } : {}),
    metadata: {
      ...perception._metadata,
      timestamp: perception._timestamp
    }
  }

  workingMemory = workingMemory.withMemory(memory)

  return [workingMemory, currentProcess]
}

export default memoryIntegrator
