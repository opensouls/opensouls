import { ChatMessageRoleEnum, MemoryIntegrator } from "@opensouls/engine"

function safeName(name?: string) {
  return (name || "").replace(/[^a-zA-Z0-9_-{}]/g, "_").slice(0, 62)
}

const memoryIntegrator: MemoryIntegrator = async ({ perception, workingMemory, currentProcess, soul }) => {
  workingMemory = workingMemory
    .withRegion("core", {
      role: ChatMessageRoleEnum.System,
      content: soul.staticMemories.core
    })
    .withRegionalOrder("core", "clue-notes", "summary", "default")

  const content = `${perception.name} ${perception.action}: "${perception.content}"`

  workingMemory = workingMemory.withMemory({
    role: perception.internal ? ChatMessageRoleEnum.Assistant : ChatMessageRoleEnum.User,
    content,
    ...(perception.name ? { name: safeName(perception.name) } : {}),
    metadata: {
      ...perception._metadata,
      timestamp: perception._timestamp
    }
  })

  return [workingMemory, currentProcess]
}

export default memoryIntegrator


