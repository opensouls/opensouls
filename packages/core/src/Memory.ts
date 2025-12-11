
export enum ChatMessageRoleEnum {
  System = "system",
  User = "user",
  Assistant = "assistant",
  Function = "function",
}

type BaseContent = {
  type: string;
};

export type OpenAIImage = {
  type: "image_url";
  image_url: ImageURL;
};

export type AnthropicImage = {
  type: "image";
  source: {
    type?: "base64";
    media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
  };
};

export type GoogleImage = {
  inlineData: {
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/heic" | "image/heif";
    data: string;
  };
};

export interface ImageURL {
  /**
   * Either a URL of the image or the base64 encoded image data.
   */
  url: string;

  /**
   * Specifies the detail level of the image. Learn more in the
   * [Vision guide](https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding).
   */
  detail?: 'auto' | 'low' | 'high';
}

export type GoogleAudio = {
  inlineData: {
    mimeType: "audio/wav" | "audio/mp3" | "audio/aiff" | "audio/aac" | "audio/ogg" | "audio/flac";
    data: string;
  };
}

export type OpenAIText = { type: "text", text: string }
export type GoogleText = { text: string };

export type ContentText = OpenAIText | GoogleText;
export type ContentImage = OpenAIImage | AnthropicImage | GoogleImage;
export type ContentAudio = GoogleAudio;
export type Content = ContentText | ContentImage | ContentAudio;

export type ChatMessageContent = string | Content[]

export interface Memory<MetaDataType = Record<string, unknown>> {
  role: ChatMessageRoleEnum;
  content: ChatMessageContent;
  name?: string;
  region?: string;
  metadata?: MetaDataType;
  
  _id: string;
  _timestamp: number;
}

export type InputMemory = Omit<Memory, "_id" | "_timestamp"> & { _id?: string, _timestamp?: number }

export function isOpenAIText(content: Content): content is OpenAIText {
  return 'type' in content && content.type === 'text';
}

export function isGoogleText(content: Content): content is GoogleText {
  return 'text' in content && !('type' in content);
}

export function isText(content: Content): content is ContentText | GoogleText {
  return isOpenAIText(content) || isGoogleText(content);
}

export function isOpenAIImage(content: Content): content is OpenAIImage {
  return 'type' in content && content.type === 'image_url';
}

export function isAnthropicImage(content: Content): content is AnthropicImage {
  return 'type' in content && content.type === 'image' && 'source' in content;
}

export function isGoogleImage(content: Content): content is GoogleImage {
  return 'inlineData' in content && content.inlineData.mimeType.startsWith('image/');
}

export function isImage(content: Content): content is ContentImage {
  return isOpenAIImage(content) || isAnthropicImage(content) || isGoogleImage(content);
}

export function isGoogleAudio(content: Content): content is GoogleAudio {
  return 'inlineData' in content && content.inlineData.mimeType.startsWith('audio/');
}

export function isAudio(content: Content): content is ContentAudio {
  return isGoogleAudio(content);
}

export const ContentTypeGuards = {
  isOpenAIText,
  isGoogleText,
  isText,
  isOpenAIImage,
  isAnthropicImage,
  isGoogleImage,
  isImage,
  isGoogleAudio,
  isAudio,
};