import type { CoreMessage } from "ai";
import { WorkingMemory } from "../../WorkingMemory.ts";
import { ChatMessageContent, ChatMessageRoleEnum, ContentTypeGuards, Memory } from "../../Memory.ts";

type CoreMessageContent = CoreMessage["content"];

export function convertMemoriesToCoreMessages(memory: WorkingMemory | Memory[]): CoreMessage[] {
  const memories = Array.isArray(memory) ? memory : memory.memories;
  return memories.map((m) => ({
    role: mapRole(m.role),
    content: convertContentToCoreMessageContent(m.content),
    ...(m.name ? { name: m.name } : {}),
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

export function convertContentToCoreMessageContent(content: ChatMessageContent): CoreMessageContent {
  if (typeof content === "string") {
    return content;
  }

  return content.map((c) => {
    if (ContentTypeGuards.isText(c)) {
      return { type: "text", text: c.text };
    }
    if (ContentTypeGuards.isImage(c) && "image_url" in c) {
      const { data, mediaType } = parseDataUrl(c.image_url.url);
      if (data && mediaType) {
        return { type: "image", image: data, mediaType };
      }
      return { type: "image", image: c.image_url.url };
    }
    if (ContentTypeGuards.isImage(c) && "source" in c) {
      return {
        type: "image",
        image: c.source.data,
        mediaType: c.source.media_type
      };
    }
    if (ContentTypeGuards.isImage(c) && "inlineData" in c) {
      return {
        type: "image",
        image: c.inlineData.data,
        mediaType: c.inlineData.mimeType
      };
    }
    if (ContentTypeGuards.isAudio(c)) {
      return { type: "text", text: "[audio]" };
    }
    return { type: "text", text: "" };
  }) as CoreMessageContent;
}

const parseDataUrl = (url: string): { data?: string; mediaType?: string } => {
  if (!url.startsWith("data:")) {
    return {};
  }
  const match = url.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    return {};
  }
  return { mediaType: match[1], data: match[2] };
};