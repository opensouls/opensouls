import { SoulEvent } from "@opensouls/engine";
import { Badge } from "@radix-ui/themes";
import { useState, useEffect } from "react";
import { FaTriangleExclamation } from "react-icons/fa6";

export default function DebugCodeUpdateBadge({ events }: { events: SoulEvent[] }) {

    const [codeUpdate, setCodeUpdate] = useState<SoulEvent | undefined>(undefined);
    const [latestEvent, setLatestEvent] = useState<SoulEvent | undefined>(undefined);

    useEffect(() => {

        const newUpdate = [...events].reverse().find(event => event.internal === true && event?._metadata?.process === "compile");
        const newEvent = events.length > 0 ? events[events.length - 1] : undefined;
        setCodeUpdate(newUpdate);
        setLatestEvent(newEvent);

    }, [events]);

    if (!codeUpdate) {
        return null;
    }

    const updateType = codeUpdate?._metadata?.type;
    const isHidden = updateType === 'success' && latestEvent?._metadata?.process !== 'compile';
    const compilerVisibility = isHidden ? 'hidden' : 'block';
    const compilerColor = updateType === "error" ? 'red' : 'indigo';
    const compilerText = updateType === "error" ? 'Soul Error' : 'Soul Updated';

    return (
        <div key={codeUpdate.content} className={`flex flex-col w-96 items-center gap-4 mt-6 duration-400 animate-fadeIn font-OS_mono_regular text-xs ${compilerVisibility}`}>
            <Badge variant="surface" color={compilerColor} className={`duration-200 flex flex-row items-center justify-center gap-4 w-32 animate-pulse`}>
                {updateType === "error" && <FaTriangleExclamation className="mr-1" />}
                <p className="text-md">{compilerText}</p>
            </Badge>

            {updateType === "error" && <p className="duration-200 w-full text-left text-zinc-400">
                {'Falling back to last successfully compiled blueprint'}
            </p>}

            <p className="duration-200 w-full mt-2 text-zinc-400 ">
                {codeUpdate.content}
            </p>

        </div>
    )
}