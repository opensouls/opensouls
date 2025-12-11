import { Command } from "commander";
import createRagPushCommand from "./push.ts";
import createRagWatch from "./watch.ts";

const createRagCommand = (program: Command) => {
  const subCommand = program.command('rag')
  createRagPushCommand(subCommand)
  createRagWatch(subCommand)

  return program
}

export default createRagCommand
