# Soul Engine (Snapshot)

**Historical Research Snapshot**: This is an approximate snapshot of code that was running in the Soul Engine roughly 2-3 years ago. We have simplified the codebase by removing authentication, cloud service requirements, and enabling it to run entirely locally. This should be considered a research snapshot, a moment in time, rather than state-of-the-art production code. Some ideas remain interesting to explore and contain relevant cognitive architecture explorations.

## What Was the Soul Engine?

The Soul Engine was built on a core belief: LLMs are incredible reasoning machines—similar to the prefrontal cortex of the brain—but they lack *the rest of the mind*. The engine was designed to model everything else: agency, memory, emotion, drive, and goal setting. Think "NextJS + Vercel for the minds of digital beings."

At its heart were two abstractions: **WorkingMemory** (an immutable collection of memories) and **cognitiveSteps** (functions that transform WorkingMemory and return typed responses). This functional, append-only approach made AI thought processes debuggable and predictable. Souls were orchestrated by **MentalProcesses**—a state machine where each process defined a behavioral mode (e.g., "introduction", "guessing", "frustrated") that could transition to another, giving souls dynamic, context-aware behavior. The engine supported multiple models (OpenAI, Anthropic, etc), offered resumable conversations with fully persistent state, integrated vector stores with atomic change tracking, and background processes for long-running computations.

The goal was never to build better chatbots—it was to create "AI Souls": agentic, embodied digital beings with personality, drive, and ego that interact with humans (and each other) in genuinely humane ways. Developers used it to bring IP characters to life, build Discord companions, create AR presences, educational tutors, game NPCs, and more. The philosophy prioritized interaction quality over accuracy, drawing inspiration from neuroscience and psychology to model minds realistically.

## Quick Start

Get chatting with Samantha in under a minute:
(after installing bun)

```bash

# Install dependencies
bun install

# Setup OpenAI API Key and Prisma client
bun run setup

# Start the Soul Engine services (includes docs server)
bun start

# Visit http://localhost:3001 for comprehensive documentation

# In a new terminal, run Simple Samantha
cd souls/examples/simple-samantha
bunx soul-engine dev

# then your browser will open up and you can chat with samantha.
```

Your browser will automatically open to a localhost url where you can chat with Samantha. She's a gen-z soul who speaks informally and tries to understand your inner world.

Try modifying the soul's personality by editing `souls/examples/simple-samantha/soul/staticMemories/core.md` — changes take effect immediately!

📚 **Documentation**: The docs at **http://localhost:3001** cover WorkingMemory, cognitiveSteps, MentalProcesses, hooks, and more.

## Example Souls

- `cd souls/examples/samantha-learns && bunx soul-engine dev` — Samantha with learning capabilities
- `cd souls/examples/hugo-guesses-rockstars && bunx soul-engine dev` — Hugo plays 20 questions about musicians

### Create your own soul
```
cd souls
bunx soul-engine init <soulName>
cd <soulName>
bunx soul-engine dev
```

### Authorization
Auth is disabled in open-source local mode. CLI/UI/Cloud accept the default local org/key without login.

### 🎉 Celebrate! 🎉

You rock!

### Troubleshooting

* If you receive an OpenAI error `404 The model "SOME_MODEL" does not exist or you do not have access to it.`, this means you have not set `OPENAI_API_KEY` in your `soul-engine-cloud`'s `.env` file or you're using a deprecated model (hey this codebase is almost 3 years old).