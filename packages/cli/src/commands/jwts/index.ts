import { Command } from "commander";
import createListJWTsCommand from "./list.ts";
import createCreateJWTCommand from "./createJWT.ts";
import createDeleteJWTCommand from "./deleteJWT.ts";

const createJWTCommand = (program: Command) => {
  const subCommand = program.command('jwts');
  createListJWTsCommand(subCommand);
  createCreateJWTCommand(subCommand);
  createDeleteJWTCommand(subCommand);
  return program;
}

export default createJWTCommand;
