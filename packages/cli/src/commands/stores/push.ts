import { Command } from "commander";
import { handleLogin } from "../../login.ts";
import { getConfig } from "../../config.ts";
import { StorePusher } from "../../stores/push.ts";
import { parsedPackageJson } from "../../packageParser.ts";

const createStoresPushCommand = (program: Command) => {
  program
    .command('push <bucketName>')
    .description('Push a specific bucket to the store. This can be in the format `:bucketName` for blueprint stores or `organization/:bucketName` for organization stores.')
    .action(async (bucketName) => {
      console.log(`Pushing blueprint store '${bucketName}' to the store.`);

      await handleLogin()
      const globalConfig = await getConfig()

      const organizationSlug = globalConfig.get("organization")
      if (!organizationSlug) {
        throw new Error("missing organization, even after login")
      }

      if (bucketName.startsWith("organization/")) {
        const pusher = new StorePusher(
          {
            organizationSlug,
            apiKey: globalConfig.get("apiKey"),
            local: true,
            bucketName: bucketName.split("/")[1],
          },
        )

        return await pusher.push()
      }

      const blueprint = parsedPackageJson().name

      const pusher = new StorePusher(
        {
          organizationSlug,
          apiKey: globalConfig.get("apiKey"),
          local: true,
          blueprint,
          bucketName,
        },
      )

      await pusher.push()
    });
}

export default createStoresPushCommand;
