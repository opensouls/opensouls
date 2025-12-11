import { Args, Command, Flags } from '@oclif/core'
import { globSync } from "glob"
import Handlebars from "handlebars"
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { getConfig } from '../config.ts'
import { handleLogin } from '../login.ts'

export default class Init extends Command {
  static args = {
    projectName: Args.string({description: 'The name of the project you want to create.', required: true}),
  }

  static description = `Create a new soul engine soul`

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    local: Flags.boolean({ char: 'l' }),
    branch: Flags.string({description: 'The branch of the template you want to use.', required: false, char: 'b' }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Init)

    await handleLogin(flags.local)
    
    const config = await getConfig()

    const { projectName } = args
    if (!projectName) {
      console.log("missing project name")
      return
    }

    const safeProjectName = projectName.replaceAll(/\s/g, "-").toLowerCase()
    const lowerCaseEntityName = safeProjectName.split("-")[0]
    const entityName = lowerCaseEntityName.charAt(0).toUpperCase() + lowerCaseEntityName.slice(1)

    const { $ } = await import('execa');
    console.log("cloning template...")

    await (flags.branch ? 
      $`git clone --branch ${flags.branch} https://github.com/opensouls/soul-engine-cli-template.git ${safeProjectName}` :
      $`git clone --depth 1 https://github.com/opensouls/soul-engine-cli-template.git ${safeProjectName}`);

    process.chdir(join('.', safeProjectName))

    rmSync('.git', { recursive: true })

    await $`git init`
    // glob files need to use the "/" even on windows machines, so cannot use path.join here.
    const files = globSync(`${process.cwd()}/**/*`, { dot: false, ignore: "node_modules/**/*" })
    const organization = config.get("organization") || "public"
    console.log("using soul-engine organization:", organization)
    const data = {
      name: projectName,
      slug: safeProjectName,
      entityName,
    }
    console.log("processing files...")
    for (const file of files) {
      try {
        if (file.includes("node_modules")) continue;
        if (file.includes("/.git/")) continue;
        const stat = statSync(file)
        if (stat.isDirectory()) continue;

        const rawFile = readFileSync(file, { encoding: "utf8" })
        const template = Handlebars.compile(rawFile)
        writeFileSync(file, template(data))
        
        if (file.includes("{{")) {
          // then it's a file where the name is templated,
          // we move it into place.
          const templateFileName = Handlebars.compile(file.replace("\\", "\\\\"));
          const newFileName = templateFileName(data);
          renameSync(file, newFileName);
        }
      } catch (error: unknown) {
        console.error("skipping...", file, error)
        // throw error
      }
    }

    console.log("npm install...")
    await $`npm install`
    console.log("and done!")
  }
}
