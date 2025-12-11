import { $ } from 'execa'
import fsExtra from 'fs-extra/esm'
import { writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const soulEngineUrl = (organizationSlug: string, local: boolean) => {
  if (local) {
    return `http://localhost:3000/api/${organizationSlug}/community-library/`
  }
  return `https://servers.souls.chat/api/${organizationSlug}/community-library/`
}

interface FetchCommunityContentParams {
  organization: string
  path: string
  local: boolean
  apiKey: string
}

const fetchCommunityContent = async ({ path, organization, local, apiKey }: FetchCommunityContentParams) => {
  console.log("looking for path", path)
  const resp = await fetch(soulEngineUrl(organization, local) + path, {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  })
  if (!resp.ok) {
    console.error("Failed to fetch", path, resp)
    throw new Error("Failed to fetch: " + path)
  }
  return resp.text()
}

const listCommunityContent = async ({ path, organization, local, apiKey }: FetchCommunityContentParams) => {
  console.log("looking for path", path)
  const resp = await fetch(soulEngineUrl(organization, local) + `list/${path}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  })
  if (!resp.ok) {
    console.error("Failed to fetch", path, resp)
    throw new Error("Failed to fetch: " + path)
  }
  return resp.json()
}

// TODO (topper):
// I think we can now generalize and just pull directory structures from the repo rather than having branching logic.

export interface CommunityInstallerOpts {
  userPath: string
  local: boolean
  apiKey: string
  organizationSlug: string
}

export class CommunityInstaller {
  public userPath: string

  constructor(public config: CommunityInstallerOpts) {
    this.userPath = config.userPath
  }

  async install() {

    const directory = dirname(this.userPath)
    switch (directory) {
      case "perceptionProcessors":
        return this.preprocessorInstall()
      case "pipelines":
        return this.pipelineInstall()
      default:
        return this.defaultInstall()
    }
  }

  async defaultInstall() {
    if (!this.userPath.endsWith(".ts")) {
      this.userPath = this.userPath + ".ts"
    }
    const data = await this.fetchFile(this.userPath)
    const directory = dirname(this.userPath)

    await fsExtra.mkdirp(join("soul", directory))

    const destinationPath = join("soul", this.userPath)
    await writeFile(destinationPath, data);
    console.log(`${this.userPath} has been installed successfully to ${destinationPath}`);
  }

  async preprocessorInstall() {
    if (!this.userPath.endsWith(".ts")) {
      this.userPath = this.userPath + ".ts"
    }
    const data = await this.fetchFile(this.userPath)
    const destinationPath = join("soul", "perceptionProcessor.ts")
    await writeFile(destinationPath, data);
    console.log(`${this.userPath} has been installed successfully to ${destinationPath}`);
  }

  async pipelineInstall() {
    await $`npm install @opensouls/pipeline`
    const directoryContents = await listCommunityContent({
      organization: this.config.organizationSlug,
      path: this.userPath,
      local: this.config.local,
      apiKey: this.config.apiKey,
    })
    console.log(directoryContents)
    await this.processPipelineDirectory(directoryContents, ".")
  }

  async processPipelineDirectory(contents: string[], basePath: string) {
    for (const item of contents) {
      if (item.includes('README')) {
        continue;
      }
      const localPath = join(basePath, item.replace(new RegExp(`^${this.userPath}/?`, "i"), ''));
      const isDirectory = item.split('/').length > 1;

      if (isDirectory) {
        await fsExtra.mkdirp(dirname(localPath));
      }
      const fileData = await this.fetchFile(item);
      await writeFile(localPath, fileData);
      console.log(`Remote ${item} written to ${localPath}`);
    }
  }

  private async fetchFile(path: string) {
    return fetchCommunityContent({
      organization: this.config.organizationSlug,
      path,
      local: this.config.local,
      apiKey: this.config.apiKey
    })
  }
}