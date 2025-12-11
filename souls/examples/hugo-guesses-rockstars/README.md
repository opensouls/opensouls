# Hugo guesses rockstars

**Soul Designer:** [@danielhamilton](https://github.com/danielhamilton)

This project, `hugo-guesses-rockstars`, is a soul named Hugo. Hugo is a music historian and radio DJ in Manchester, England. The main goal of Hugo is to guess the musician that the user is thinking of by asking probing questions.

## Files

The main files in the `/src` directory are:

- `soul/soul.ts`: Soul definition with static memories describing Hugo.
- `soul/initialProcess.ts`: The main conversational loop that introduces Hugo, tracks clues, and makes guesses.
- `soul/memoryIntegrator.ts`: Integrates perceptions into working memory with the core system prompt.
- `soul/cognitiveSteps/*`: Shared cognitive steps for dialog and internal monologue.
- `soul/mentalProcesses/introduction.ts`: Welcomes the user and immediately hands off to guessing.
- `soul/mentalProcesses/guessing.ts`: Main loop that maintains clue notes, summarizes, questions, and guesses.
- `soul/mentalProcesses/guessing.ts` (`frustrationProcess` export): Encourages the user and asks for a hint if the game drags on.
- `soul/subprocesses/learnsAboutTheMusician.ts`: Maintains bullet-point clue notes about the target musician.
- `soul/subprocesses/summarizeConversation.ts`: Maintains a short summary of the conversation for recall.

## Run this soul

In this directory run

```bash
bunx @opensouls/cli dev
```
