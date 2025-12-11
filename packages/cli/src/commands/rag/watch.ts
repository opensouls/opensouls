import path from "node:path"

import { getConfig } from '../../config.ts'
import { handleLogin } from '../../login.ts'
import { RagPoster } from '../../rag/rag-file-poster.ts'
import { Command } from "commander"

const createRagWatch = (program: Command) => {
  program
    .command('watch <path>')
    .description('Push your RAG files to your SOUL ENGINE bucket.')
    .action(async (ragPath) => {
      await handleLogin()
      const globalConfig = await getConfig()

      const organization = globalConfig.get("organization")
      if (!organization) {
        throw new Error("missing organization, even after login")
      }

      const defaultRagDir = path.join(".", "rag")

      const ragDir = ragPath || defaultRagDir

      const poster = RagPoster.createWithDefaultConfig({
        path: ragDir,
        organization,
        local: true,
        apiKey: globalConfig.get("apiKey"),
        // root: ragDir
      })

      const keepAliveInterval = setInterval(() => {
        // do nothing
      }, 60 * 1000); // keep process alive

      try {
        poster.watch()

        return new Promise<void>((resolve) => {
          console.log("watching your rag files...")
          process.on('SIGINT', () => {
            console.log('Received SIGINT. Exiting.');
            clearInterval(keepAliveInterval);
            resolve();
          });
        });
      } catch (error) {
        console.error("there was an error posting your RAG files:", error)
        throw error
      }
    })
}

export default createRagWatch
