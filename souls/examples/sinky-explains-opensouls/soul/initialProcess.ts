import { MentalProcess, useActions, useProcessManager, useSoulMemory } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import findsOutAboutTheUser from "./mentalProcesses/findOutAboutTheUser.js";
import noticesTheTime from "./mentalProcesses/noticesTheTime.js";

const sagtHallo: MentalProcess = async ({ workingMemory: memory }) => {
  const { speak, scheduleEvent } = useActions();
  const { setNextProcess } = useProcessManager();
  const pendingScheduled = useSoulMemory("pendingScheduled", false);

  let stream;

  scheduleEvent({
    process: noticesTheTime,
    in: 30, // notice the time every 60s,
    perception: {
      name: "Sinky",
      action: "notice",
      content: "the time",
    },
  });
  pendingScheduled.current = true;

  [memory, stream] = await externalDialog(memory, "Introduce yourself to the user. Welcome them graciously!", {
    stream: true,
  });
  speak(stream);
  await memory.finished;

  setNextProcess(findsOutAboutTheUser);

  return memory;
};

export default sagtHallo;
