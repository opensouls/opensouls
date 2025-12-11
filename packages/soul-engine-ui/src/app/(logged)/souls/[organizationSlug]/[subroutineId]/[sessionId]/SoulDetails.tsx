"use client";

import { useSoulSessionEventLog } from "@/hooks/useSoulSessionState";
import SoulDetailsMessage from "./SoulDetailsMessage";

export default function SoulDetails({ organizationSlug, subroutineId, sessionId }: { organizationSlug: string; subroutineId: string; sessionId: string }) {
  const { events } = useSoulSessionEventLog(organizationSlug, subroutineId, sessionId);
  const nonSystemEvents = events.filter((event) => event._kind !== "system");

  return (
    <div className="pb-40">
      <div className="pt-4 pb-2 rt-Text font-OS_bold text-zinc-300 text-base">Messages</div>
      <ul className="px-4">
        {nonSystemEvents.map((event, index) => (
          <SoulDetailsMessage key={index} event={event} />
        ))}
      </ul>
    </div>
  );
}
