import { WorkingMemory } from "../../WorkingMemory.ts";
import { ChatMessageContent, ChatMessageRoleEnum } from "../../Memory.ts";

export function convertMemoriesToCoreMessages(memory: WorkingMemory): any[] {
  return memory.memories.map(m => ({
    role: mapRole(m.role),
    content: m.content,
    name: m.name,
  }));
}

function mapRole(role: ChatMessageRoleEnum): "user" | "assistant" | "system" | "tool" | "data" {
  switch (role) {
    case ChatMessageRoleEnum.System:
      return "system";
    case ChatMessageRoleEnum.User:
      return "user";
    case ChatMessageRoleEnum.Assistant:
      return "assistant";
    case ChatMessageRoleEnum.Function:
      return "tool";
    default:
      return "user";
  }
}

export function convertContentToCoreMessageContent(content: ChatMessageContent): string | Array<{ type: string; text?: string; image?: string }> {
  if (typeof content === "string") {
    return content;
  }

  return content.map(c => {
    if ("type" in c && c.type === "text") {
      return { type: "text", text: c.text };
    }
    if ("type" in c && c.type === "image_url") {
      return { type: "image", image: c.image_url.url };
    }
    if ("type" in c && c.type === "image" && "source" in c) {
      return {
        type: "image",
        image: `data:${c.source.media_type};base64,${c.source.data}`
      };
    }
    if ("inlineData" in c) {
      return {
        type: "image",
        image: `data:${c.inlineData.mimeType};base64,${c.inlineData.data}`
      };
    }
    return { type: "text", text: "" };
  });
}
