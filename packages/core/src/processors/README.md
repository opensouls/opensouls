# LLM Processors in @opensouls/core

This document provides an overview of the LLM processor system in the @opensouls/core package. It's intended for developers who need to modify existing processors or add new ones.

## Overview

The processor system is designed to handle interactions with various Language Model providers (e.g., OpenAI, Anthropic) in a consistent manner. It includes:

1. Individual processor implementations (e.g., `OpenAIProcessor`, `AnthropicProcessor`)
2. A unified stream reader (`llmStreamReader`)
3. A processor registry for easy access and management

## Key Components

### 1. Processor Interface

All processors implement the `Processor` interface, which includes a public `process` method:

```typescript
interface Processor {
process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>>
}```

In addition, all processors include a private `execute` function as well which typically handles actually calling the LLM client and returning the formatted response

```typescript
private async execute<SchemaType = any>({}: ProcessOpts<SchemaType>): Promise<Omit<ProcessResponse<SchemaType>, "parsed">> {}
```

### 2. LLM Stream Reader

The `createLLMStreamReader` function in `llmStreamReader.ts` handles the streaming responses from different LLM providers, unifying their output format.

### 3. Processor Registry

Processors are registered using the `registerProcessor` function, allowing for easy access and management. They get loaded and called through the `soulEngineProcessor` in the soul-engine-cloud project

## Adding a New Processor

To add a new LLM provider:

1. Create a new file (e.g., `NewProviderProcessor.ts`) in the `processors` directory.
2. Implement the `Processor` interface.
3. Use the `createLLMStreamReader` function to handle streaming responses.
4. Register the new processor in the registry:
```typescript
registerProcessor(NewProviderProcessor.label, (opts: Partial<NewProviderProcessorOpts> = {}) => new NewProviderProcessor(opts))
```
5. Add type definitions for the new provider's chunk format in `llmStreamReader.ts`.
6. Update the `processChunk` function in `llmStreamReader.ts` to handle the new provider's chunk format.
7. Create a test file (e.g., `NewProviderProcessor.spec.ts`) with comprehensive tests.

