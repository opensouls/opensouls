import { ChatCompletionCreateParams, ChatCompletionMessageParam } from "openai/resources/index.mjs"
import { ChatMessageContent, ChatMessageRoleEnum, ContentImage, ContentText, Memory } from "../Memory.ts"
import { ContentTypeGuards } from "../Memory.ts"

export interface FixMethods {
  singleSystemMessage?: boolean
  forcedRoleAlternation?: boolean
}

export const fixMessageRoles = (fixMethods: FixMethods, messages: (Memory | ChatCompletionMessageParam)[]): ChatCompletionMessageParam[] => {
  if (!fixMethods.singleSystemMessage && !fixMethods.forcedRoleAlternation) {
    return messages as ChatCompletionMessageParam[]
  }

  let newMessages = messages

  if (fixMethods.singleSystemMessage) {
    newMessages = messages.map((originalMessage, i) => {
      const message = { ...originalMessage }
      if (i === 0) {
        return message
      }
      if (message.role === ChatMessageRoleEnum.System) {
        message.role = ChatMessageRoleEnum.User
        return message
      }
      return message
    }) as ChatCompletionMessageParam[]
  }

  if (fixMethods.forcedRoleAlternation) {
    // now we make sure that all the messages alternate User/Assistant/User/Assistant
    let lastRole: ChatCompletionCreateParams["messages"][0]["role"] | undefined
    const { messages } = newMessages.reduce((acc, message) => {
      // If it's the first message or the role is different from the last, push it to the accumulator
      if (lastRole !== message.role) {
        acc.messages.push(message);
        lastRole = message.role;
        acc.grouped = [message.content as ChatMessageContent]
      } else {
        // If the role is the same, combine the content with the last message in the accumulator
        const lastMessage = acc.messages[acc.messages.length - 1];
        acc.grouped.push(message.content as ChatMessageContent)

        lastMessage.content = mergeContent(acc.grouped)
      }

      return acc;
    }, { messages: [], grouped: [] } as { grouped: ChatMessageContent[], messages: (Memory | ChatCompletionMessageParam)[] })

    newMessages = messages
    if (newMessages[0]?.role === ChatMessageRoleEnum.Assistant) {
      newMessages.unshift({
        content: "...",
        role: ChatMessageRoleEnum.User
      })
    }
  }

  return newMessages as ChatCompletionMessageParam[]
}

const extractTextFromContent = (content: ChatMessageContent): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((c) => {
      if (typeof c === 'string') {
        return c;
      }
      if (ContentTypeGuards.isText(c)) {
        return c.text;
      }
      return ''; // Return empty string for image contents or unknown types
    }).filter(Boolean).join('\n');
  }

  return '';
}

const extractImageFromContent = (content: ChatMessageContent): ContentImage[] => {
  if (Array.isArray(content)) {
    return content.filter(ContentTypeGuards.isImage) as ContentImage[]
  }

  return []
}

const mergeContent = (messages: ChatMessageContent[]): ChatMessageContent => {
  const newContent: ChatMessageContent = [
    {
      type: "text",
      text: ""
    }
  ]

  for (const message of messages) {
    const txt = extractTextFromContent(message);
    const images = extractImageFromContent(message);
    newContent.push(...images);
    (newContent[0] as ContentText).text += txt + "\n\n"
  }

  return newContent
}