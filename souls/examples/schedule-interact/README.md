# Samantha schedules an event, can interact with scheduled event

**Soul Designer:** [@stripy](https://github.com/stripy1026)

This soul is based on schedul-tester from @tobowers,
Add some little interactions to Samantha.
When a user said don't, she stops poking them and starts politely asking.
sometimes she refuses their denial.

The soul is composed of 2 mental processes:

- `pokesSpeaker`: a simple process that tells the user they are going to poke them, schedules poke event, and always set next process to asksToSpeaker.

- `asksToSpeaker`: computes mental query to decide if user denied to be poked or not

The source code for these processes can be found in the `./soul` directory.

## Run this soul

In this directory run

```bash
npx soul-engine dev
```
