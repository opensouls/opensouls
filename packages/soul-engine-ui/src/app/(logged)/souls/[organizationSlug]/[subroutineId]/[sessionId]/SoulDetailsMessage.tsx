import { DebugMessage } from "@/components/DebugMessage";
import { SoulEvent, SoulEventKinds } from "@opensouls/engine";
import { Text } from "@radix-ui/themes";

export default function SoulDetailsMessage({ event }: { event: SoulEvent }) {
  const isSoul = event._kind === SoulEventKinds.InteractionRequest;
  const isUser = event._kind === SoulEventKinds.Perception && !event.internal;
  const isSystem = event._kind === SoulEventKinds.System || event.internal;
  const isSpeech = ["said", "says"].includes(event.action);

  return (
    <div className="mt-4">
      <DebugMessage m={event} isSpeech={isSpeech} isUser={isUser} isSoul={isSoul} />
      {event.content && (
        <div
          className={`flex flex-col justify-between gap-6 p-2 pl-4 pr-4 rounded-sm ${!event.content ? "text-red-500" : ""}`}
          style={{ backgroundColor: isSoul ? "var(--slate-2)" : isUser ? "var(--iris-2)" : "var(--slate-3)" }}
        >
          <Text className="font-OS_regular whitespace-pre-wrap" size={isSystem ? "1" : "3"}>
            {event.content?.replace(/Interlocutor said:/i, "") ?? "Error: null or undefined message content"}
          </Text>
        </div>
      )}
    </div>
  );
}
