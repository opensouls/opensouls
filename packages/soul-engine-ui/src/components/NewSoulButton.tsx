import { Text, Button } from "@radix-ui/themes";
import { FaCopy } from "react-icons/fa";
import { FaCircleCheck } from "react-icons/fa6";
import { useState } from "react";
import "./Header.css"

export default function NewSoulButton() {
  const [copied, setCopied] = useState(false);

  const handleCopyClick = () => {
    navigator.clipboard.writeText("bunx soul-engine init <soul-name>");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      onClick={handleCopyClick}
      className="disappearWhenSmall flex justify-center align-middle transition duration-75 ease-in-out hover:scale-105 hover:shadow-lg"
    >
      {copied ? (
        <FaCircleCheck className="w-4 h-4 text-md text-emerald-400" />
      ) : (
        <FaCopy className="w-4 h-4 text-md" />
      )}

      <Text className="tracking-tighter font-OS_mono_regular hover:font-OS_mono_medium">
        bunx soul-engine init {"<name>"}
      </Text>
    </Button>
  );
}
