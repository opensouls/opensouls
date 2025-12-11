
import { MentalProcess, useActions } from "@opensouls/engine";
import withRagContext from "../cognitiveFunctions/withRagContext";

const updatesFromBlueprintStore: MentalProcess = async ({ workingMemory }) => {
  const { log } = useActions()

  log("updating the working memory with knowledge from the blueprint store.")

  return withRagContext(workingMemory)
}

export default updatesFromBlueprintStore
