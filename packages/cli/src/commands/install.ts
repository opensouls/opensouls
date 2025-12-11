import { Command } from 'commander'
import fsExtra from 'fs-extra/esm'
import { CommunityInstaller } from '../communityInstaller.ts'
import { getConfig } from '../config.ts'

const createInstall = (program: Command) => {
  program
    .command('install')
    .argument('<packagePath...>', 'The full path of the library package (eg cognitiveStep/externalDialog). You can specify multiple library packages.')
    .description('install a community package from the OPEN SOULS community library found here https://github.com/opensouls/community/tree/main/library')
    .action(async (packagePaths: string[]) => {
      const globalConfig = await getConfig()
      const org = globalConfig.get("organization")
      const apiKey = globalConfig.get("apiKey")
      
      for (let packagePath of packagePaths) {
        if (!(await fsExtra.pathExists("soul"))) {
          console.error("You must be in the root of a soul project to install a community package.")
          return
        }

        const installer = new CommunityInstaller({
          userPath: packagePath,
          local: true,
          apiKey: apiKey,
          organizationSlug: org,
        })
        await installer.install()
      }
    })
}

export default createInstall
