import { MentalProcess } from "@opensouls/engine"
import introductionProcess from "./mentalProcesses/introduction.ts"

const initialProcess: MentalProcess = async ({ workingMemory }) => {
  // Immediately transition into the introduction mental process and execute it.
  return [workingMemory, introductionProcess, { executeNow: true }]
}

export default initialProcess


