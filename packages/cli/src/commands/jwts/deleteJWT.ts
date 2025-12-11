import { Command } from "commander";
import inquirer, { DistinctQuestion } from "inquirer";
import { handleLogin } from "../../login.ts";
import { getConfig } from "../../config.ts";
import JWTManager from "../../jwt/jwt-api.ts";

const createDeleteJWTCommand = (program: Command) => {
  program
    .command('delete')
    .description('Delete a JWT for the organization')
    .option('-i, --id <id>', 'ID of the JWT to delete', '')
    .action(async ({ id }) => {
      await handleLogin();
      const globalConfig = await getConfig();

      const organizationSlug = globalConfig.get("organization");
      if (!organizationSlug) {
        throw new Error("missing organization, even after login");
      }

      const prompt:DistinctQuestion[] = [];

      if (!id || id.trim() === '') {
        prompt.push({
          type: 'input',
          name: 'id',
          message: 'ID of the JWT to delete:',
          validate: (input) => {
            if (input.trim() === '') {
              return 'JWT ID cannot be empty';
            }
            return true;
          },
        });
      }

      prompt.push({
        type: 'confirm',
        name: 'confirmDeletion',
        message: `Are you sure you want to delete this JWT? (There is no undo)'}?`,
        default: false,
      });

      const answers = await inquirer.prompt(prompt);

      if (!answers.confirmDeletion) {
        console.log('JWT deletion cancelled.');
        return;
      }

      const jwtId = id || answers.id;
      console.log(`Deleting JWT with ID ${jwtId} for ${organizationSlug}.`);

      const jwtManager = new JWTManager(true, organizationSlug, globalConfig.get("apiKey"));
      const result = await jwtManager.deleteJWT(jwtId);

      if (result) {
        console.log(`JWT with ID ${jwtId} has been successfully deleted.`);
      } else {
        console.log(`Failed to delete JWT with ID ${jwtId}. Please check the ID and try again.`);
      }
    });

  return program;
}

export default createDeleteJWTCommand;
