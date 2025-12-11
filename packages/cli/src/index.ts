import { Command } from "commander";
import { setupCLI } from "./commands/index.ts";

export const run = () => {
  const program = new Command();
  setupCLI(program);
  return program.parseAsync()
}
