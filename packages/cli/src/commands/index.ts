import { Command } from "commander";
import createApiKeyCommand from "./apikey.ts";
import createDev from "./dev.ts";
import createInit from "./init.ts";
import createLogout from "./logout.ts";
import createLogin from "./login.ts";
import createRagCommand from "./rag/index.ts";
import createInstall from "./install.ts";
import createStoreCommand from "./stores/index.ts";
import createJWTCommand from "./jwts/index.ts";

export const setupCLI = (program: Command) => {
  createApiKeyCommand(program);
  createDev(program);
  createInit(program);
  createLogin(program);
  createLogout(program);
  createRagCommand(program);
  createStoreCommand(program);
  createInstall(program);
  createJWTCommand(program);
}
