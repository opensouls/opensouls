# Agents Guide

This repository runs on clean TypeScript and Bun. Use Bun’s built-in tooling (`bun install`, `bun run`, `bun test`, `bunx`) and standard ESM style; avoid Node-only APIs unless required.

You will have to answer to very senior typescript developers, so keep your code clean, readable, functions small, classes isolated, and everything well tested. Rich Hickey himself should enjoy reading your code.

## Stack and expectations
- Runtime: Bun 1.2+, TypeScript-first across services.
- Style: small, readable modules; favor pure functions and explicit types.
- Testing: prefer `bun test` locally; align with existing specs per package.
- Env: secrets live in per-package `.env`/`.env.local` files; check examples before running.

## Code Style
- **Workspace**: Multiple bun projects are in this repo located in the runtime and the integrations directories. Each of the directories in there has its own `package.json` file. When working on a project, you should be within its individual directory instead of the project root.
- **Runtime**: Bun only (no Node/npm/pnpm). More rules in `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`.
- **Imports**: Use `import` statements, no require(), avoid dynamic imports (even in tests).
- **Types**: Strict TypeScript, prefer explicit types
- **Naming**: camelCase for variables/functions, PascalCase for react components
- **Error handling**: Use try/catch with proper error messages
- **Formatting**: 2-space indent

## Layout (active)
- `packages/soul-engine-cloud`: Bun backend for the Soul Engine (Supabase/Prisma, Hono server, workers, storage, RAG).
- `packages/soul-engine-ui`: Next.js debugger/chat UI for the engine.
- `packages/shared-context`: shared context service/data utilities.
- `packages/embedding-service`: embedding helper service.
- `packages/public`: pre-open-source bundle snapshots (do not modify without context).
- `library/`: copy/paste building blocks for cognitive steps/pipelines/subprocesses.
- `node-only/voice-server`: voice server example (Bun scripts, Node-focused).
- `scripts/`: maintenance utilities (e.g., `bumpNpmPackages.ts`).

## Legacy / archived
- `npm-packages/`: now archived after migration; keep read-only for historical reference only.
- `legacy/`: historical demos and engines kept for reference only.

