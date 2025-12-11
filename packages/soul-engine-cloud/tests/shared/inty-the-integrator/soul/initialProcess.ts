
import { MentalProcess, useActions, useSoulStore } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.ts";

const gainsTrustWithTheUser: MentalProcess = async ({ workingMemory }) => {
  const { speak  } = useActions()
  const { set, fetch } = useSoulStore();

  set("isGood", true);

  await fetch("isGood");

  const [withDialog, stream] = await externalDialog(
    workingMemory,
    "Talk to the user trying to gain trust and learn about their inner world.",
    { stream: true, model: "fast" }
  );
  speak(stream);

  return withDialog;
}

export default gainsTrustWithTheUser
