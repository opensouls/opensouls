import { ChatMessageRoleEnum, MentalProcess, useActions, usePerceptions, useSoulMemory } from "@opensouls/engine";
import externalDialog from "../cognitiveSteps/externalDialog.js";

const noticesTheTime: MentalProcess = async ({ workingMemory: memory }) => {
  const { scheduleEvent, log, speak } = useActions();
  const pendingScheduled = useSoulMemory("pendingScheduled", false);
  const { invokingPerception } = usePerceptions();
  if (!invokingPerception) {
    log("missing invoking perception");
    throw new Error("missing invoking perception, this should not happen");
  }

  log("sinky notices the time");

  const time = new Date(invokingPerception._timestamp);
  // let's take a look at the last message
  const lastUserMessage = [...memory.memories].reverse().find((m) => m.role === ChatMessageRoleEnum.User);
  const timeOfLastUserMessage = new Date((lastUserMessage?.metadata?.timestamp as number | undefined) || 0);

  // if it has been greater than 5 minute since the last message then we'll just give up on talking to the user.
  if (time.getTime() - timeOfLastUserMessage.getTime() > 5 * 60 * 1000) {
    log("sinky gives up on the user");
    [memory] = await externalDialog(memory, "Looks like you're not there anymore, I'll let you be");
    return memory
  }

  log("last message", timeOfLastUserMessage.toLocaleString(), lastUserMessage);

  if (time.getTime() - timeOfLastUserMessage.getTime() > 30 * 1000) {
    log("it's been over 30s");
    let stream;
    [memory, stream] = await externalDialog(
      memory,
      "Ask the user if you're boring them? Slinky says something interesting about themself.",
      { stream: true }
    );
    speak(stream);
    await memory.finished;
  }

  log("would reschedule the events");
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

  return memory.withMemory({
    role: ChatMessageRoleEnum.Assistant,
    content: `Sinky notices the time is ${time.toLocaleTimeString()}.`,
  });
};

export default noticesTheTime;
