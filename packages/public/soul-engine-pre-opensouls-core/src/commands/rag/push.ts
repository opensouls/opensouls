import { Args, Command, Flags } from '@oclif/core'
import path from "node:path"

import { getConfig } from '../../config.ts'
import { handleLogin } from '../../login.ts'
import { RagPoster } from '../../rag/rag-file-poster.ts'

export default class RagPush extends Command {
  static args = {
    path: Args.string({
      description: 'The path to the RAG files, defaults to the current working directory.',
      optional: true,
    }),
  }

  static description = 'Push your RAG files to your SOUL ENGINE bucket.'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    local: Flags.boolean({ char: 'l' }),
  }

  public async run(): Promise<void> {
    const { flags, args } = await this.parse(RagPush)
    
    await handleLogin(flags.local)
    const globalConfig = await getConfig(flags.local)

    const organization = globalConfig.get("organization")
    if (!organization) {
      throw new Error("missing organization, even after login")
    }
    
    const defaultRagDir = path.join(".", "rag")

    const ragDir = args.path || defaultRagDir

    const poster = RagPoster.createWithDefaultConfig({
      path: ragDir,
      organization,
      local: flags.local,
      apiKey: globalConfig.get("apiKey"),
    })

    try {
      await poster.push()  
    } catch (error) {
      console.error("there was an error posting your RAG files:", error)
      throw error
    }
  }
}
