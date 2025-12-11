import { Command, Flags } from '@oclif/core'
import { existsSync, readFileSync } from 'node:fs'
import path from "node:path"
import { v4 as uuidv4 } from 'uuid'

import { getConfig } from '../config.ts'
import { FilePoster } from '../debugChat/file-poster.ts'
import { SoulConfig } from '../index.ts'
import { handleLogin } from '../login.ts'
import { RagPoster } from '../rag/rag-file-poster.ts'

export default class Dev extends Command {
  static args = {
    // local: Args.boolean({description: 'If you are developing the soul engine locally this will default to a local server.'}),
  }

  static description = 'Hot reload your code for remote chat debug'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    local: Flags.boolean({ char: 'l' }),
    once: Flags.boolean(),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Dev)
    await handleLogin(flags.local)

    const globalConfig = await getConfig(flags.local)

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

    const apiKey = globalConfig.get("apiKey") as string|undefined || "TOOD: fix me"
 
    const watcher = new FilePoster({
      apiKey,
      paths: soulConfig.paths ?? ["."],
      root: soulConfig.path ?? ".",
      organizationSlug: organization,
      blueprint: soulConfig.soul,
      local: flags.local,
    })

    // eslint-disable-next-line no-warning-comments
    // TODO: this is a dumb quick fix to make sure we see bad things happening. "stateless" is a poor name for this event.
    watcher.once("stateless", () => {
      if (flags.once) {
        console.log("posted")
        return
      }

      const url = flags.local ? `http://localhost:3000/chats/${organization}/${soulConfig.soul}/${uuidv4()}` : `https://souls.chat/chats/${organization}/${soulConfig.soul}/${uuidv4()}`

      console.log("opening", url)

      open(url)
    })

    await watcher.start()

    if (flags.once) {
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
        local: flags.local,
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
  }
}
