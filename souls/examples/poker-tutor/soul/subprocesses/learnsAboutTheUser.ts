import {
  ChatMessageRoleEnum,
  MentalProcess,
  indentNicely,
  useActions,
  useProcessMemory
} from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import userNotes from "../cognitiveSteps/userNotes.js";

const learnsAboutTheUser: MentalProcess = async ({ workingMemory: memory }) => {
  const userModel = useProcessMemory("Unkown User");
  const { log } = useActions();

  memory = memory.withMemory({
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ${memory.soulName} remembers:

      # User model

      ${userModel.current}
    `,
  });

  const [withLearnings, learnings] = await internalMonologue(
    memory,
    { instructions: "What have I learned specifically about the user from the last few messages?", verb: "noted" },
    { model: "gpt-4-0125-preview" }
  );
  log("Learnings:", learnings);
  const [, notes] = await userNotes(withLearnings, undefined, { model: "gpt-4-0125-preview" });
  log("Notes:", notes);
  userModel.current = notes;

  const [, thought] = await internalMonologue(
    memory,
    {
      instructions: "What should I think to myself to change my behavior? Start with 'I need...'",
      verb: "thinks",
    },
    { model: "gpt-4-0125-preview" }
  );
  return memory.withMemory({
    role: ChatMessageRoleEnum.Assistant,
    content: `${memory.soulName} thinks to themself: ${thought}`,
  });
};
export default learnsAboutTheUser;
