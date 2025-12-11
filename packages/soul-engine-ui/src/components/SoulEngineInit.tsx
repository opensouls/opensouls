import { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons";
import { RiGhostLine } from "react-icons/ri";


export default function ClipboardCopy() {
  const [inputValue, setInputValue] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [errorTooltipVisible, setErrorTooltipVisible] = useState(false); // Add state for error tooltip visibility

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.trim() !== "") {
      setErrorTooltipVisible(false); // Hide error tooltip when user starts typing
    }
  };

  const copyToClipboard = async () => {
    if (inputValue.trim() === "") {
      setErrorTooltipVisible(true); // Show error tooltip when inputValue is empty
      setTimeout(() => setErrorTooltipVisible(false), 2000); // Hide error tooltip after 2 seconds
      return; // Prevent the copy operation
    }
    await navigator.clipboard.writeText(
      `bunx soul-engine init ${inputValue.replace(/\s+/g, "-")}`
    );
    setIsCopied(true);
    setTooltipVisible(true);
    setTimeout(() => {
      setIsCopied(false);
      setTooltipVisible(false);
    }, 2000);
  };

  return (
    <div className="flex flex-row justify-between border border-zinc-600 rounded-sm text-sm shadow-xl">
      <div className="flex items-center pl-4 pr-1 py-1 bg-zinc-700 text-zinc-100 font-OS_mono_regular tracking-tighter whitespace-nowrap">
        bunx soul-engine init
        <div className="flex">
          <input
            type="text"
            className="form-input font-OS_medium ml-4 mr-1 px-4 bg-zinc-100 py-1 flex rounded-sm focus:outline-none focus:ring focus:ring-zinc-600 focus:border-slate-700 text-slate-700"
            placeholder="Soul Name"
            onChange={handleInputChange}
          />
          <Tooltip.Provider delayDuration={0}>
            <Tooltip.Root open={tooltipVisible || errorTooltipVisible}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={copyToClipboard}
                  className={`p-3 rounded-sm transition duration-100 ease-in-out border ${
                    isCopied
                      ? "bg-zinc-950 border-lime-600"
                      : "bg-zinc-700 hover:bg-zinc-600 border-zinc-700"
                  }`}
                >
                  {isCopied ? (
                    <CheckIcon className="h-4 w-4 text-lime-300" />
                  ) : (
                    <CopyIcon className="h-4 w-4 text-zinc-100" />
                  )}
                </button>
              </Tooltip.Trigger>
              {isCopied && (
                <Tooltip.Content
                  side="bottom"
                  className="px-2 py-2 mt-4 bg-zinc-700/70 text-lime-300 rounded-sm font-OS_medium text-sm tracking-normal"
                  align="end"
                >
                  Copied. Paste in the terminal.
                </Tooltip.Content>
              )}
              {errorTooltipVisible && (
                <Tooltip.Content
                  side="bottom"
                  className="flex flex-row px-2 py-2 mt-4 bg-red-700/50 text-white rounded-sm font-OS_medium text-sm tracking-normal"
                  align="end"
                >
                   <span className="pr-1">
                    <RiGhostLine className="text-lg" /></span> 
                    Don&apos;t forget to name your soul!
                </Tooltip.Content>
              )}
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>
    </div>
  );
}
