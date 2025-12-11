import { BunPlugin } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';

export const loadToStaticPlugin = (requiredContainer: string) => {
  const plugin: BunPlugin = {
    name: 'load-to-static-string',
    setup(build) {
      build.onLoad({ filter: /soul\.ts/ }, async ({ path: codFilePath }) => {
        let contents = await fs.readFile(codFilePath, 'utf8');

        const filePromises: Record<string, Promise<string>> = {};

        // Replace load function calls with static strings
        contents = contents.replace(/(?:await\s+)?load\s?\((.*?)\)/g, (_, filePath) => {
          const relativeContentPath = filePath.slice(1, -1); // strip any kind of quotes
          const absoluteContentPath = path.resolve(path.dirname(codFilePath), relativeContentPath);

          // make sure the user isn't trying to escape their own code container
          if (!absoluteContentPath.startsWith(requiredContainer)) {
            throw new Error(`File path ${absoluteContentPath} does not start with the required container ${requiredContainer}`);
          }

          filePromises[absoluteContentPath] = (async () => {
            const content = await fs.readFile(absoluteContentPath, 'utf8');
            if (content.includes('load(') || content.includes('${')) {
              throw new Error("imported file contains load or template string");
            }
            return content
          })()

          return `____${absoluteContentPath}____`;
        });

        await Promise.all(Object.values(filePromises));

        for (const [filePath, filePromise] of Object.entries(filePromises)) {
          const fileContent = await filePromise;
          contents = contents.replace(`____${filePath}____`, `\`${fileContent}\``);
        }
  
        return {
          contents,
          loader: 'ts',
        };
      });
    },
  };

  return plugin
}

export default loadToStaticPlugin;
