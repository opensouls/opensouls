import { Json } from "@opensouls/engine";
import { CaretDownIcon, CaretLeftIcon, CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { useMemo, useState, useRef, useEffect } from "react";
import { useHover } from "@uidotdev/usehooks";

export const LENGTH_TRUNCATE = 100;

export type StateType = Json | number | string | undefined;
export type EntryProps = {
    state: StateType;
    index: number | string;
    animation?: string;
    expanded?: boolean;
}

type MemoryCellProps = EntryProps & {
    CustomComponent?: React.ComponentType<any>;
    customComponentProps?: any;
};

export type MemoryCellEntryProps = MemoryCellProps

// Memory Cell - Process State Values
function insertWordBreaks(text: string) {
    // Split text on underscores and non-alphanumerics, but keep them in results
    return text.split(/(_|\W)/).map((part, index) => {
        // If the part is an underscore or non-alphanumeric, return character with a word break opportunity.
        if (part === '_' || (/\W/.test(part) && !/\s/.test(part))) {
            return <><span key={index}>{part}</span><wbr /></>;
        }
        return part;
    });
}

const MemoryCell: React.FC<MemoryCellProps> = ({
    state,
    index,
    animation,
    ...props
}) => {

    const isArray = Array.isArray(state) && state.length > 0;
    const isObject = typeof state === 'object' && state !== null && !isArray && Object.keys(state).length > 0;
    const cellWidth = isArray ? 'w-auto' : 'w-36';
    const [hoverRef, isHovered] = useHover();
    const canCollapse = isObject || isArray;
    const [unfurled, setUnfurled] = useState(true);

    let Component = null;

    if (isArray) {
        if (state.length === 0) {
            return <div key={`${index}.array`}></div>;
        } else {
            Component = state.map((s, i) => (
                <div key={`${index}.array.${i}`} className="flex flex-row items-start py-1 first:border-t border-b border-zinc-900">
                    <div className={`pl-4 text-xs font-OS_mono_regular text-lime-700 flex-shrink-0 ${typeof i === 'number' ? 'w-auto pr-4' : 'w-[20px] pr-2'}`}>
                        {i}
                    </div>
                    <MemoryCellEntry state={s} index={i} animation={animation} {...props} />
                </div>
            ))
        }
    } else {
        Component = <MemoryCellEntry key={`${index}.value`} state={state} index={index} animation={animation} {...props} />
    }

    return (
        <div className={`relative flex-1 py-2 ${isArray || isObject ? "flex flex-col justify-start items-start gap-2" : "border-b border-zinc-900 flex flex-row justify-start items-start gap-0"}`} ref={hoverRef}>
            <div className={`break-words text-xs font-OS-medium text-lime-600 flex-shrink-0 ${typeof index === 'number' ? `${cellWidth} pr-4 pl-2` : `${cellWidth} pr-2`}`}>
                {typeof index === 'string' ? insertWordBreaks(index) : index}
            </div>
            {(isArray || isObject) && (
                <div className="absolute right-0 top-2 flex flex-row gap-1 items-center z-50 text-lime-600">
                    {isHovered && <CopyButton value={isArray ? JSON.stringify(state) : isObject ? JSON.stringify(state, null, 2) : state as unknown as string} />}
                    {canCollapse && (!unfurled || isHovered) && <CollapseButton unfurled={unfurled} setUnfurled={setUnfurled} />}
                </div>
            )}
            {unfurled && <div className={`flex flex-col w-full ${isObject && 'pl-4 border-t border-b border-zinc-900 py-2'}`}>
                {Component}
            </div>}
        </div>
    );
};


const MemoryCellEntry = ({
    state,
    index,
    animation,
    CustomComponent,
    customComponentProps,
    ...props
}: MemoryCellEntryProps) => {

    const containerRef = useRef<HTMLDivElement>(null);
    const [boxHoverRef, isBoxHovered] = useHover();
    const stringState = useMemo(() => {
        return (JSON.stringify(state, null, 2) || "")
    }, [state]);

    const textTruncate = useTextHiding(stringState, containerRef);

    const stateStringWithoutQuotes = useMemo(() => {
        return stringState
            .replace(/^"/g, "")
            .replace(/"$/g, "")
            .replace(/\\n/g, "\n")
    }, [stringState]);


    return (
        <div className="relative flex-1" style={{ animation: animation }} ref={boxHoverRef}>
            <div className="relative font-OS_mono_regular text-slate-300 text-xs leading-relaxed tracking-normal">
                <CopyCollapseButton value={stateStringWithoutQuotes} isHovering={isBoxHovered} {...textTruncate} />
                {CustomComponent ? (
                    <CustomComponent
                        state={state}
                        index={index}
                        expanded={textTruncate.unfurled}
                        {...props}
                        {...customComponentProps}
                    />
                ) : (
                    <div className={textTruncate.isLong ? textTruncate.unfurled ? "h-auto" : "max-h-[8em] overflow-y-hidden" : ""} ref={containerRef}>
                        <MemoryStateRenderer state={stateStringWithoutQuotes} />
                    </div>
                )}
            </div>
        </div>
    )
}


const CopyCollapseButton = ({ isHovering, value, unfurled, setUnfurled, isLong, tooLargeForContainer }: {
    isHovering: boolean,
    value: string,
} & ReturnType<typeof useTextHiding>) => {
    return (
        <div className="absolute right-0.5 top-0.5 flex flex-row gap-1 items-center z-50">
            {isHovering && <CopyButton value={value} />}
            {isLong && tooLargeForContainer && <CollapseButton unfurled={unfurled} setUnfurled={setUnfurled} />}
        </div>
    )
}

const CopyButton = ({ value }: { value: string }) => {
    const [copyIcon, copy] = useCopy(value);
    return (
        <div className="p-0 flex flex-col justify-center items-center bg-zinc-900 hover:bg-zinc-700 rounded-md" onClick={() => copy()}>
            <div className="scale-75">
                {copyIcon}
            </div>
        </div>
    )
}
const CollapseButton = ({ unfurled, setUnfurled }: { unfurled: boolean, setUnfurled: (unfurled: boolean) => void }) => {
    return (
        <div className="p-0 bg-zinc-900 hover:bg-zinc-700 rounded-md" onClick={() => setUnfurled(!unfurled)}>
            {unfurled ? <CaretDownIcon /> : <CaretLeftIcon />}
        </div>
    )
}

const MemoryStateRenderer: React.FC<{
    state: string;
}> = ({ state }) => {
    return (
        <pre
            className="font-OS_mono_regular tracking-tight leading-tight whitespace-pre-wrap break-words"
            style={{ overflowWrap: 'anywhere' }}>
            {state}
        </pre>
    )
}

function useTextHiding(text: string, containerRef: React.RefObject<HTMLDivElement>) {
    const [unfurled, setUnfurled] = useState(false);
    const [tooLargeForContainer, setTooLargeForContainer] = useState(true);
    const isLong = text.length > LENGTH_TRUNCATE;

    useEffect(() => {
        if (containerRef.current) {
            const { scrollHeight, clientHeight } = containerRef.current;
            setTooLargeForContainer(scrollHeight > clientHeight);
        }
    }, [text]);

    return {
        isLong,
        unfurled,
        setUnfurled,
        tooLargeForContainer,
    }
}

function useCopy(text: string) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        await new Promise((resolve) => setTimeout(() => {
            setCopied(false);
            resolve(null);
        }, 2000));
    }

    const component = copied ? <CheckIcon /> : <CopyIcon />;
    return [component, copy] as const;
}

export { MemoryCell, MemoryCellEntry }