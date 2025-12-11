# Alfred Names

**Soul Designer:** [@kafischer](https://github.com/kafischer)

The idea behind this soul is that naming a thing goes back and forth between:

- questions
- going on tangents
- suggesting names

Here, name suggestion is pushed off into a subprocess that does extra work and thinking behind the scenes

The `modelsTheThing` subprocess learns a model of what the user wants in the name and uses that model to help generate the name. When it generates names of sufficient quality they're said, otherwise the process of choosing a bad name guides the cognition with an internal thought

## In detail

The `alfred-names` soul works by using a combination of foreground and background processes to generate and refine names based on user input. Be sure to checkout:

- `soul/initialProcess.ts`: Uses a combination of welcoming dialogues, insightful questions, and internal decision-making processes to determine the course of the conversation
- `soul/mentalProcesses/brainstorms.ts`: A decision-making process to dynamically choose between asking thought-provoking questions or sharing interesting facts, with the aim of effectively moving the naming conversation forward without ever suggesting a name directly
- `soul/subProcesses/compress.ts`: Create a compressed and updated narrative of the conversation history between the user and the AI entity
- `soul/subProcesses/modelsTheThing.ts`: Process for learning a model of what the user wants in a name, responsible to also bubbling up good names to the main process

## Run this soul

In this directory run

```bash
npx soul-engine dev
```