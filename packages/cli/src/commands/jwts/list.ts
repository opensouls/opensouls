import { Command } from "commander";
import { handleLogin } from "../../login.ts";
import { getConfig } from "../../config.ts";
import JWTManager from "../../jwt/jwt-api.ts";
import Table from 'cli-table3'

const createListJWTsCommand = (program: Command) => {
  program
    .command('list')
    .description('List JWTs for the organization')
    .action(async () => {
      console.log(`Listing JWTs for the organization.`);

      await handleLogin()
      const globalConfig = await getConfig()

      const organizationSlug = globalConfig.get("organization")
      if (!organizationSlug) {
        throw new Error("missing organization, even after login")
      }

      const jwtManager = new JWTManager(true, organizationSlug, globalConfig.get("apiKey"));
      const jwts = await jwtManager.listJWTs();

      const table = new Table({
        head: ["ID", "Issuer", "Created At"]
      })
      table.push(...jwts.map((jwt: any) => [jwt.id, jwt.issuer, jwt.created_at]))

      console.log(table.toString())
    });

  return program;
}

export default createListJWTsCommand;
