import { Command, Flags } from '@oclif/core'

import { handleLogin } from '../login.ts'

export default class Login extends Command {
  static description = 'Login to the Soul Engine to provide this CLI with an api key and organization.'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    local: Flags.boolean({ char: 'l' }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login)
    return handleLogin(flags.local, true)
  }
}
