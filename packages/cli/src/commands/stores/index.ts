import { Command } from "commander";
import createStoresPullCommand from "./pull.ts";
import createStoresPushCommand from "./push.ts";


const createStoreCommand = (program: Command) => {
  const subCommand = program.command('stores')
  createStoresPullCommand(subCommand)
  createStoresPushCommand(subCommand)
  
  return program
}

export default createStoreCommand
