# Raggy pitches

**Soul Designer:** [@tobowers](https://github.com/tobowers)

This soul, named Raggy, is designed to demonstrate the blueprint-wide memory capabilities built into the soul engine. There are docs in the `/docs` directory and running `npm run docs:chunk` will move them into the `stores/docs` directory. `npm run docs:push` will sync the soul engine with the chunked docs.

Then, souls within the organization can access the information contained in those files.

The source code for these processes can be found in the `./soul` directory.

## Run this soul

In this directory run

```bash
npm run docs:chunk
```

```bash
npm run docs:push
```

then

```bash
npx soul-engine dev
```
