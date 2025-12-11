import { Command } from "commander";
import { handleLogin } from "../../login.ts";
import { getConfig } from "../../config.ts";
import { StorePuller } from "../../stores/pull.ts";
import { parsedPackageJson } from "../../packageParser.ts";

const createStoresPullCommand = (program: Command) => {
  program
    .command('pull <bucketName>')
    .description('Pull a specific bucket from the store. This can be in the format `:bucketName` for blueprint stores or `organization/:bucketName` for organization stores.')
    .action(async (bucketName) => {
      console.log(`Pulling blueprint store '${bucketName}' from the store.`);

      await handleLogin()
      const globalConfig = await getConfig()

      const organizationSlug = globalConfig.get("organization")
      if (!organizationSlug) {
        throw new Error("missing organization, even after login")
      }

      if (bucketName.startsWith("organization/")) {
        const puller = new StorePuller(
          {
            organizationSlug,
            apiKey: globalConfig.get("apiKey"),
            local: true,
            bucketName: bucketName.split("/")[1],
          },
        )

        return await puller.pull()
      }

      const blueprint = parsedPackageJson().name

      const puller = new StorePuller(
        {
          organizationSlug,
          apiKey: globalConfig.get("apiKey"),
          local: true,
          blueprint,
          bucketName,
        },
      )

      await puller.pull()
    });
}

export default createStoresPullCommand;

