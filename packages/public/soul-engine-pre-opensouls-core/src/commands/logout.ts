import { Command, Flags } from '@oclif/core'

import { getConfig } from '../config.ts'

export default class Logout extends Command {
  static description = 'Logout of the Soul Engine to remove your api key and organization.'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    local: Flags.boolean({ char: 'l' }),
  }

  public async run(): Promise<void> {
    const { flags: { local } } = await this.parse(Logout)
    const globalConfig = await getConfig(local)
    globalConfig.set("apiKey", "")
    globalConfig.set("organization", "")
    globalConfig.set("organization_id", "")
  }
}
