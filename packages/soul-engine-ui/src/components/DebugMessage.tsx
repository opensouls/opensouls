import { useState } from "react";
import { SoulEvent } from "@opensouls/engine";
import { Text, Badge } from "@radix-ui/themes";
import { RxCode, RxLineHeight } from "react-icons/rx";
import { useHover } from "@uidotdev/usehooks";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { formatDistanceToNow } from "date-fns";

export type MessageProps = {
    m: SoulEvent;
    isSpeech: boolean;
    isUser: boolean;
    isSoul: boolean;
    showName?: boolean;
    showTimestamp?: boolean;
    textSize?: "1" | "3";
    backgroundColor?: string;
}

export function DebugMessage({ m,
    isSpeech,
    isUser,
    isSoul,
    showName = false,
    showTimestamp = false,
    textSize = "3",
    backgroundColor = "var(--iris-2)"
}: MessageProps) {

    const { stateId, streamComplete, streaming, ...metadata } = m._metadata || {};

    const hasMetadata = Object.keys(metadata)?.length > 0 ? true : false;
    const hasLotsOfMetadata = hasMetadata && JSON.stringify(metadata).length > 100;
    
    const [unfurled, setUnfurled] = useState(!m.content && hasMetadata);
    const [metadataRef, metadataHovered] = useHover();
    const [copied, setCopied] = useState(false);

    //metadata without stateID, streamComplete, or streaming
    const color = `${isUser ? "text-slate-300" : "text-lime-500"}`

    async function copy(e: React.MouseEvent<HTMLDivElement>) {
        navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
        setCopied(true);
        await new Promise(() => setTimeout(() => setCopied(false), 2000));

    }
    function unfurl(e: React.MouseEvent<HTMLDivElement> | undefined) {
        e?.stopPropagation();
        setUnfurled(!unfurled);
        setCopied(false);
    }

    return (
        <>
            <div className="w-full flex flex-row gap-1 p-2 items-center justify-between">
                <div className="flex flex-row gap-1 items-center">
                    <div className="mr-2 whitespace-nowrap max-w-48 overflow-clip">
                        <Text className={`font-OS_bold tracking-wider ${color}`}>
                            {isUser ? (m.name ?? 'Interlocutor') : (m.name ?? 'Soul')}
                        </Text>
                    </div>
                    <Badge
                        className={'h-5 opacity-75'}
                        size={'1'}
                        variant="outline"
                        color={isUser ? 'gray' : 'lime'}
                    >
                        <p className="font-OS_mono_light text-xs tracking-tighter whitespace-nowrap max-w-36 overflow-hidden pb-0.5 select-text">
                            {m.action}
                        </p>
                    </Badge>
                    {hasMetadata && <>
                        <Badge
                            className={`h-5 ${unfurled ? 'hover:opacity-100 opacity-100' : 'hover:opacity-100 opacity-75'}`}
                            size={'1'}
                            variant={"outline"}
                            color={isUser ? 'gray' : 'lime'}
                            onClick={(e) => unfurl(undefined)}
                            ref={metadataRef}
                        >
                            {hasMetadata &&
                                <RxCode className={isUser ? 'text-slate-200' : 'text-lime-200'} size={14} />
                            }
                        </Badge>
                    </>}
                </div>
                <div className="flex flex-row gap-1 items-center">
                    {showTimestamp && 
                        <p className="opacity-50 text-[.65em] -mb-1 font-OS_mono_light">{formatDistanceToNow(new Date(m._timestamp), { addSuffix: true })}</p>
                    }
                </div>
            </div>

            {unfurled && hasMetadata &&
                <div
                    className={`relative flex flex-col mb-2 mx-2 px-4 py-2 rounded-lg border border-slate-600 hover:opacity-100 opacity-75`}
                    key={`metadata-${m._id}`}
                    onClick={copy}
                >
                    <div className="absolute right-2.5 top-2.5 flex flex-row gap-1 text-slate-400">
                        {copied ? <CheckIcon /> : <CopyIcon />}
                    </div>

                    <p
                        className={`whitespace-pre-wrap text-xs font-mono break-words leading-snug tracking-tighter text-slate-200`}
                        style={{ overflowWrap: "anywhere" }}
                    >
                        {hasLotsOfMetadata ? JSON.stringify(metadata, null, 2) : JSON.stringify(metadata)}
                    </p>
                </div>}
            {m.content && <div
                className={`relative flex flex-row items-start whitespace-normal break-words justify-between gap-3 p-2 pb-1 rounded-sm ${!m.content ? "text-red-500" : ""} min-h-9`}
                style={{ backgroundColor, overflowWrap: "anywhere" }}
            >
                <Text
                    className="font-OS_regular"
                    size={textSize}
                >
                    {m.content?.replace(/Interlocutor said:/i, "") ?? "Error: null or undefined message content"}
                </Text>
            </div>}


        </>
    );
}
