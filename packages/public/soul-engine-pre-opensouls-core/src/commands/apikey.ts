import { Command, Flags } from '@oclif/core'

import { getConfig } from '../config.ts'

export default class Apikey extends Command {
  static description = 'print your api key to the terminal. This command is useful for connecting to a debug chat.'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    local: Flags.boolean({ char: 'l' }),
  }


  public async run(): Promise<void> {
    const { flags } = await this.parse(Apikey)

    const globalConfig = await getConfig(flags.local)

    console.log("API KEY:", globalConfig.get("apiKey"))
  }
}
