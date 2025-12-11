
import { MentalProcess, useActions } from "@opensouls/engine";

const provesEnvironmentVariablesWork: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()

  log("liked things: " + JSON.stringify(soul.env.likedThings))
  log("entity name: " + workingMemory.soulName)

  speak($$("I like {{likedThings}}."))

  return workingMemory
}

export default provesEnvironmentVariablesWork
