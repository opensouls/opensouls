import { Memory } from "@opensouls/engine";
import { CaretDownIcon, CaretLeftIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

const LENGTH_TRUNCATE = 200;

export default function WorkingMemoryDivider({
  message: m,
  showRegion,
  index,
}: {
  message: Memory;
  showRegion: boolean;
  index: number;
}) {

  const text = useMemo(() => {
    return typeof m.content === 'string' ? JSON.parse(JSON.stringify(m.content)) : JSON.stringify(JSON.parse(JSON.stringify(m.content)), null, 2);
  }, [m.content]);

  return (
    <div className="flex flex-col w-full">
      {!showRegion &&
        <div className={`flex flex-row h-6 w-full items-center`}>
          <Box className="flex-grow border-t border-t-gray-700" />
        </div>}
        
      <Box className={`flex flex-row w-full px-2 items-start ${showRegion && "mt-3"} text-[var(--gray-11)]`}>
        <Text
          style={{ overflowWrap: "anywhere" }}
          className="w-6 min-w-6 pt-0.5 text-xs font-OS_bold text-lime-500"
        >
          {index}
        </Text>
        <Text className="grow text-sm font-OS_medium text-slate-300 leading-none whitespace-pre-wrap" style={{ overflowWrap: "anywhere" }}>
          {text}
        </Text>
      </Box>
    </div>
  );
}

export function RegionHeader({ className, regionName, children }: { className: string, regionName: string, children?: React.ReactNode }) {
  const [visible, setVisible] = useLocalStorage(regionName, true, { initializeWithValue: false });

  return (
    <div className={className}>
      <Badge
        className="w-full flex-grow text-xs font-OS_mono_light leading-none whitespace-nowrap overflow-hidden"
        size={'1'}
        variant="soft"
        color="lime"
      >
        <div className="w-full flex flex-row items-center justify-between pb-0.5">
          <div>
            {regionName || "default"}
          </div>
          <div className="">

            <Button
              size={'1'}
              color="lime"
              variant="ghost"
              className="opacity-25 h-2"
              onClick={() => setVisible(!visible)}
            >
              {visible ? <CaretDownIcon /> : <CaretLeftIcon />}
            </Button>
          </div>
        </div>
      </Badge>

      {visible &&
        <div className="px-1 pb-2">
          {children}
        </div>}

    </div>
  );
} 