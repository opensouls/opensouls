# Vercel AI SDK Migration Plan

## Summary

Migrate the 3 remaining processors (OpenAI, Anthropic, Google) to use `ai` (Vercel AI SDK) for streaming and text generation, removing custom `llmStreamReader` logic. The existing `ProcessResponse` interface will be preserved to maintain backward compatibility.

## Dependencies to Add

```json
{
  "ai": "^3.x",
  "@ai-sdk/openai": "^0.x",
  "@ai-sdk/anthropic": "^0.x", 
  "@ai-sdk/google": "^0.x"
}
```

**Remove** (replaced by Vercel AI SDK):
- Direct `openai` SDK usage (keep types only)
- Direct `@anthropic-ai/sdk` usage (keep types only)
- `gpt-tokenizer` (Vercel handles token counting)
- `web-streams-polyfill`

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

### 4. packages/core/src/processors/Processor.ts

Add a helper function to convert Vercel SDK stream results to `ProcessResponse`:

```typescript
export function wrapVercelSDKResponse<T>(
  result: StreamTextResult,
  schema?: ZodSchema<T>
): ProcessResponse<T>
```

### 5. Files to Delete

- packages/core/src/utils/llmStreamReader.ts - replaced by Vercel SDK
- packages/core/src/processors/OpenAICompatibleProcessor.ts - per decision

### 6. Update packages/core/src/processors/index.ts

Remove `OpenAICompatibleProcessor` export.

## Key Implementation Details

**Message Conversion**: Create a shared utility to convert `WorkingMemory` to Vercel AI SDK's `CoreMessage[]` format:

```typescript
function memoryToCoreMessages(memory: WorkingMemory): CoreMessage[] {
  return memory.memories.map(m => ({
    role: m.role,
    content: m.content, // Handle text/image/audio content
  }));
}
```

**Preserving ProcessResponse Interface**: Wrap Vercel SDK's response:

```typescript
return {
  stream: result.textStream, // Vercel provides this
  rawCompletion: result.text, // Promise<string>
  parsed: schema ? parseJSON(result.text, schema) : result.text,
  usage: result.usage.then(u => ({ model, input: u.promptTokens, output: u.completionTokens }))
};
```

**Image Support**: Vercel AI SDK natively supports images in the `CoreMessage` format - the existing image conversion logic in each processor can be simplified or removed.

**Retry Logic**: Vercel AI SDK has built-in retry support via `maxRetries` option, replacing `exponential-backoff` usage.

## Testing

- Run existing tests in `packages/core/tests/processors/` - they should pass without modification
- Delete `llmStreamReader.spec.ts` (file being removed)
- Update tests if any mock custom stream chunks (they'll now mock Vercel SDK)

## Migration Steps

1. Add Vercel AI SDK dependencies to package.json
2. Create message conversion helper and ProcessResponse wrapper in Processor.ts
3. Refactor OpenAIProcessor to use @ai-sdk/openai
4. Refactor AnthropicProcessor to use @ai-sdk/anthropic
5. Refactor GoogleProcessor to use @ai-sdk/google
6. Delete llmStreamReader.ts, OpenAICompatibleProcessor.ts, update index.ts
7. Run tests, update stream reader test file

