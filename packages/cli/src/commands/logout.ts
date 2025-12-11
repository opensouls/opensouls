import { Command } from 'commander'
import { getConfig } from '../config.ts'

const createLogout = (program: Command) => {
  program
    .command('logout')
    .description('Logout of the Soul Engine to remove your api key and organization.')
    .action(async () => {
      const globalConfig = await getConfig()
      globalConfig.set("apiKey", "")
      globalConfig.set("organization", "")
    })

}

export default createLogout