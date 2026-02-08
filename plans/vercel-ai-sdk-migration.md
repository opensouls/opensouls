# Vercel AI SDK Migration Plan (SDK v6)

## Summary

Migrate the 3 existing processors (OpenAI, Anthropic, Google) plus new OpenRouter processor to use `ai` (Vercel AI SDK v6) for streaming and text generation. The existing `ProcessResponse` interface will be preserved to maintain backward compatibility.

## Migration Phases

### Phase 1: Foundation (This PR)
- Install Vercel AI SDK v6 and provider packages
- Create OpenRouterProcessor as the first implementation using Vercel SDK
- Create shared utilities for message conversion and response wrapping

### Phase 2: Core Processor Migration
- Migrate OpenAIProcessor to use @ai-sdk/openai
- Migrate AnthropicProcessor to use @ai-sdk/anthropic
- Migrate GoogleProcessor to use @ai-sdk/google

### Phase 3: Cleanup
- Remove deprecated dependencies
- Delete llmStreamReader.ts
- Run full test suite

## Dependencies to Add (SDK v6)

```json
{
  "ai": "^4.0.0",
  "@openrouter/ai-sdk-provider": "^1.0.0",
  "@ai-sdk/openai": "^1.0.0",
  "@ai-sdk/anthropic": "^1.0.0", 
  "@ai-sdk/google": "^1.0.0"
}
```

**Remove** (replaced by Vercel AI SDK):
- Direct `openai` SDK usage (keep types only)
- Direct `@anthropic-ai/sdk` usage (keep types only)
- `gpt-tokenizer` (Vercel handles token counting)
- `web-streams-polyfill`

## Files to Create

### 1. packages/core/src/processors/OpenRouterProcessor.ts

New processor using @openrouter/ai-sdk-provider:

```typescript
import { openrouter } from "@openrouter/ai-sdk-provider";
import { streamText, generateText } from "ai";

// In execute():
const result = await streamText({
  model: openrouter(model),
  messages: convertMemoriesToCoreMessages(memory),
  maxTokens,
  temperature,
  abortSignal: signal,
});
```

### 2. packages/core/src/processors/shared/messageConverter.ts

Shared utility to convert WorkingMemory to Vercel AI SDK's CoreMessage[] format:

```typescript
import { CoreMessage } from "ai";
import { WorkingMemory } from "../../WorkingMemory.ts";
import { ChatMessageContent } from "../../Memory.ts";

export function convertMemoriesToCoreMessages(memory: WorkingMemory): CoreMessage[] {
  return memory.memories.map(m => ({
    role: mapRole(m.role),
    content: m.content,
    name: m.name,
  }));
}

function mapRole(role: ChatMessageRoleEnum): "user" | "assistant" | "system" | "tool" | "data" {
  // ... mapping logic
}
```

### 3. packages/core/src/processors/shared/responseWrapper.ts

Helper function to convert Vercel SDK stream results to ProcessResponse:

```typescript
import { StreamTextResult } from "ai";
import { ProcessResponse } from "../Processor.ts";
import { ZodSchema } from "zod";

export function wrapVercelSDKResponse<T>(
  result: StreamTextResult,
  schema?: ZodSchema<T>
): ProcessResponse<T> {
  return {
    stream: result.textStream,
    rawCompletion: result.text,
    parsed: schema ? parseJSON(result.text, schema) : result.text,
    usage: result.usage.then(u => ({ 
      model: result.model, 
      input: u.promptTokens, 
      output: u.completionTokens 
    })),
  };
}
```

## Files to Modify

### 1. packages/core/src/processors/OpenAIProcessor.ts

Replace the `execute` method to use `@ai-sdk/openai`:

```typescript
import { openai } from "@ai-sdk/openai";
import { streamText, generateText } from "ai";

// In execute():
const result = await streamText({
  model: openai(model),
  messages: convertMemoriesToCoreMessages(memory),
  maxTokens,
  temperature,
  abortSignal: signal,
});
```

Wrap Vercel SDK responses to match `ProcessResponse` interface.

### 2. packages/core/src/processors/AnthropicProcessor.ts

Similar conversion using `@ai-sdk/anthropic`:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

const result = await streamText({
  model: anthropic(model),
  messages: convertMemoriesToCoreMessages(memory),
  // ...
});
```

### 3. packages/core/src/processors/GoogleProcessor.ts

Similar conversion using `@ai-sdk/google`:

```typescript
import { google } from "@ai-sdk/google";
import { streamText } from "ai";

const result = await streamText({
  model: google(model),
  // ...
});
```

### 4. packages/core/src/processors/index.ts

Add OpenRouterProcessor export:

```typescript
export * from "./OpenRouterProcessor.ts"
```

## Files to Delete

- packages/core/src/processors/OpenAICompatibleProcessor.ts - per decision
- packages/core/src/utils/llmStreamReader.ts - replaced by Vercel SDK

## Key Implementation Details (SDK v6)

**Message Conversion**: Create a shared utility to convert `WorkingMemory` to Vercel AI SDK's `CoreMessage[]` format (see messageConverter.ts above).

**Preserving ProcessResponse Interface**: Wrap Vercel SDK's response:

```typescript
return {
  stream: result.textStream, // Vercel provides this
  rawCompletion: result.text, // Promise<string>
  parsed: schema ? parseJSON(result.text, schema) : result.text,
  usage: result.usage.then(u => ({ model, input: u.promptTokens, output: u.completionTokens }))
};
```

**Image Support**: Vercel AI SDK v6 natively supports images in the `CoreMessage` format - the existing image conversion logic in each processor can be simplified or removed.

**Retry Logic**: Vercel AI SDK has built-in retry support via `maxRetries` option, replacing `exponential-backoff` usage.

## Testing

- Run existing tests in `packages/core/tests/processors/` - they should pass without modification
- Delete `llmStreamReader.spec.ts` (file being removed)
- Update tests if any mock custom stream chunks (they'll now mock Vercel SDK)

## Migration Steps

First run tests to make sure they pass before starting.

1. Add Vercel AI SDK v6 dependencies to package.json with `bun add ai` etc (don't just edit the package.json)
2. Create shared messageConverter.ts utility
3. Create shared responseWrapper.ts utility
4. Create OpenRouterProcessor using @ai-sdk/openrouter (this PR)
5. Refactor OpenAIProcessor to use @ai-sdk/openai
6. Refactor AnthropicProcessor to use @ai-sdk/anthropic
7. Refactor GoogleProcessor to use @ai-sdk/google
8. Delete llmStreamReader.ts, OpenAICompatibleProcessor.ts, update index.ts
9. Run tests, update stream reader test file

