import { Command } from "commander";
import inquirer, { DistinctQuestion, QuestionCollection } from "inquirer";
import { handleLogin } from "../../login.ts";
import { getConfig } from "../../config.ts";
import JWTManager from "../../jwt/jwt-api.ts";

const createCreateJWTCommand = (program: Command) => {
  program
    .command('create')
    .description('Create a JWT for the organization')
    .option('-i, --issuer <issuer>', 'Issuer for the JWT', '')
    .action(async ({ issuer }) => {

      await handleLogin();
      const globalConfig = await getConfig();

      const organizationSlug = globalConfig.get("organization");
      if (!organizationSlug) {
        throw new Error("missing organization, even after login");
      }

      console.log(`Creating a JWT for ${organizationSlug} with issuer ${issuer}.`);

      const prompt: DistinctQuestion[] = [
        {
          type: 'confirm',
          name: 'confirmCreation',
          message: 'Do you want to create a new JWT?',
          default: false,
        },
      ]

      if (!issuer || issuer.trim() === '') {
        prompt.unshift({
          type: 'input',
          name: 'issuer',
          message: 'Issuer for the JWT:',
          validate: (input) => {
            if (input.trim() === '') {
              return 'Issuer cannot be empty';
            }
            return true;
          },
        })
      }

      const answers = await inquirer.prompt(prompt);
      if (answers.issuer) {
        issuer = answers.issuer;
      }

      if (!answers.confirmCreation) {
        console.log('JWT creation cancelled.');
        return
      }

      console.log(`Creating a JWT for ${organizationSlug} with issuer ${issuer}.`);

      const jwtManager = new JWTManager(true, organizationSlug, globalConfig.get("apiKey"));
      const newJWT = await jwtManager.createJWT(issuer);
      console.log('New JWT created:');
      console.log('ID:', newJWT.id);
      console.log('Issuer:', newJWT.issuer);
      console.log('Created At:', newJWT.created_at);
      console.log('Private Key:');
      console.log(newJWT.privateKey);
      console.log('Please save the private key securely. It will not be shown again.');

    });

  return program;
}

export default createCreateJWTCommand;
