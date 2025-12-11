import { Command } from 'commander'
import { handleLogin } from '../login.ts'

const createLogin = (program: Command) => {
  program
    .command('login')
    .description('Login to the Soul Engine to provide this CLI with an api key and organization.')
    .action(async () => {
      await handleLogin()
    })
}

export default createLogin
