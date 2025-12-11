import { $ } from "bun";
import inquirer from "inquirer";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(scriptDir, "..");
const cloudDir = join(repoRoot, "packages", "soul-engine-cloud");
const envPath = join(cloudDir, ".env");
const envExamplePath = join(cloudDir, ".env.example");

type OverwriteAnswer = { continueWithExisting: boolean };
type KeyAnswer = { openAIApiKey: string };

const upsertEnvValue = (content: string, key: string, value: string): string => {
  const lines = content.split(/\r?\n/);
  let replaced = false;

  const nextLines = lines
    .map((line) => {
      if (line.startsWith(`${key}=`)) {
        replaced = true;
        return `${key}=${value}`;
      }
      return line;
    })
    .filter((line, index, arr) => !(index === arr.length - 1 && line.trim() === ""));

  if (!replaced) {
    nextLines.push(`${key}=${value}`);
  }

  return `${nextLines.join("\n")}\n`;
};

const ensureBaseEnv = async (): Promise<boolean> => {
  const envExists = await Bun.file(envPath).exists();
  const exampleExists = await Bun.file(envExamplePath).exists();

  if (envExists) {
    const { continueWithExisting } = await inquirer.prompt<OverwriteAnswer>([
      {
        type: "confirm",
        name: "continueWithExisting",
        message: ".env already exists. Update OPENAI_API_KEY in place?",
        default: true
      }
    ]);

    if (!continueWithExisting) {
      console.log("Leaving existing .env untouched.");
      return false;
    }
    return true;
  }

  if (exampleExists) {
    console.log("Copying .env.example to .env...");
    await $`cp ${envExamplePath} ${envPath}`;
    return true;
  }

  console.log("No .env.example found. Creating a new .env file.");
  await Bun.write(envPath, "");
  return true;
};

const generatePrismaClient = async (): Promise<void> => {
  console.log("Generating Prisma client...");
  await $`bunx --bun prisma generate`.cwd(cloudDir);
  console.log("Prisma client generated in packages/soul-engine-cloud.");
};

const main = async (): Promise<void> => {
  console.log("Setting up packages/soul-engine-cloud/.env");

  const shouldUpdateApiKey = await ensureBaseEnv();

  if (shouldUpdateApiKey) {
    const { openAIApiKey } = await inquirer.prompt<KeyAnswer>([
      {
        type: "password",
        name: "openAIApiKey",
        message: "Enter your OpenAI API key:",
        mask: "*",
        validate: (value: string) => value.trim().length > 0 || "API key cannot be empty."
      }
    ]);

    const trimmedKey = openAIApiKey.trim();
    const existingContent = await Bun.file(envPath).exists() ? await Bun.file(envPath).text() : "";
    const nextContent = upsertEnvValue(existingContent, "OPENAI_API_KEY", trimmedKey);

    await Bun.write(envPath, nextContent);
    console.log(`Updated ${envPath} with OPENAI_API_KEY.`);
  } else {
    console.log("Skipping OPENAI_API_KEY update.");
  }

  await generatePrismaClient();

  console.log("\nSetup complete! ✅");
  if (shouldUpdateApiKey) {
    console.log("- OPENAI_API_KEY has been written to packages/soul-engine-cloud/.env");
  }
  console.log("- Prisma client has been generated in packages/soul-engine-cloud");
};

await main().catch((error) => {
  console.error("Failed to set up soul-engine-cloud/.env", error);
  process.exit(1);
});

