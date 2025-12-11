import { existsSync, readFileSync } from 'node:fs'
import path from "node:path"
import { v4 as uuidv4 } from 'uuid'

import { getConfig } from '../config.ts'
import { FilePoster } from '../debugChat/file-poster.ts'
import { SoulConfig } from '@opensouls/engine'
import { handleLogin } from '../login.ts'
import { RagPoster } from '../rag/rag-file-poster.ts'
import { Command } from 'commander'

const createDev = (program: Command) => {
  program
    .command('dev')
    .description('Hot reload your code for remote chat debug')
    .option('--once', 'Only post the code once, do not watch for changes', false)
    .option("-n, --noopen", 'Do not automatically open the browser', false)
    .option("--id <id>", 'Set the SoulId, otherwise assigns a UUID', uuidv4())
    .action(async ({ once, noopen, id }) => {
      await handleLogin()
      const globalConfig = await getConfig()

      const organization = globalConfig.get("organization")
      if (!organization) {
        throw new Error("missing organization, even after login")
      }

      const { default: open } = await import('open');

      let soulConfig: SoulConfig

      const optionalConfigPath = path.join(process.cwd(), "soul-engine.json")
      
      if (existsSync(optionalConfigPath)) {
        soulConfig = JSON.parse(readFileSync(optionalConfigPath, { encoding: "utf8" }))
      } else {
        // parse the package.json and extract the name
        const packageJsonPath = path.join(process.cwd(), "package.json")
        const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: "utf8" }))

        soulConfig = {
          soul: packageJson.name,
          paths: [
            "package.json",
            "soul",
          ],
        }
      }

      const apiKey = globalConfig.get("apiKey") as string|undefined || "local-insecure-key"
   
      const watcher = new FilePoster({
        apiKey,
        paths: soulConfig.paths ?? ["."],
        root: soulConfig.path ?? ".",
        organizationSlug: organization,
        blueprint: soulConfig.soul,
        local: true,
      })

    let resolve: () => void = () => {}
    const synedOncePromise = new Promise<void>((r) => { resolve = r })  

    // eslint-disable-next-line no-warning-comments
    // TODO: this is a dumb quick fix to make sure we see bad things happening. "stateless" is a poor name for this event.
    watcher.once("stateless", () => {
      if (once) {
        console.log("posted")
        resolve()
        return
      }

      console.log('SoulId:', id);
      const url = `http://localhost:3000/chats/${organization}/${soulConfig.soul}/${id}`

      console.log("debug chat available at", url)

      if (!noopen) {
        open(url)
      }
    })

    await watcher.start()

    if (once) {
      await synedOncePromise
      return
    }


    const keepAliveInterval = setInterval(() => {
      // do nothing
    }, 60 * 1000); // keep process alive

    const ragDirPath = path.join(process.cwd(), "rag");
    if (existsSync(ragDirPath)) {
      const ragFilePoster = RagPoster.createWithDefaultConfig({
        path: ragDirPath,
        organization,
        local: true,
        apiKey,
      })
      ragFilePoster.watch();
    }

    return new Promise<void>((resolve) => {
      console.log("watching your files...")
      process.on('SIGINT', () => {
        console.log('Received SIGINT. Exiting.');
        clearInterval(keepAliveInterval);
        watcher.stop()
        resolve();
      });
    });
  })
}

export default createDev
