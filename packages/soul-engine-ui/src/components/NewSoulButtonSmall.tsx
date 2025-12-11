import { Container, Text, Flex, Box, Button } from "@radix-ui/themes";
import Image from "next/image";
import { FaCopy, FaCheck } from "react-icons/fa";
import { FaCircleCheck } from "react-icons/fa6";
import { useState } from "react";
import { Cross1Icon } from "@radix-ui/react-icons";

const command = "bunx soul-engine init <your-new-soul>";

export default function NewSoulButton() {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const toggleCode = () => setShowCode((prev) => !prev);

  const handleCopyClick = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <Button onClick={toggleCode} size="2" variant="soft">
          <FaCopy width="16" height="16" />
        <Text className="">New Soul</Text>
      </Button>

      {/* Overlay */}
      <Box
        className="h-[100vh] w-[100vw] fixed inset-0 z-10 bg-black/70 backdrop-blur-sm"
        style={{
          display: showCode ? "block" : "none",
        }}
      ></Box>
      <Box
        className="h-[100vh] w-[100vw] z-10 flex"
        style={{
          display: showCode ? "block" : "none",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
        }}
      >
        {/* Modal Container */}
        <Flex direction="row" justify="center">
          <Box
            style={{
              backgroundColor: "var(--gray-3)",
              marginTop: "96px",
              padding: "24px",
              borderRadius: "4px",
            }}
          >
            {/* Copy Button and Close */}
            <Flex align="center" justify="between" gap={'2'}>
              <Button
                variant="outline"
              >
                <pre className="text-sm font-OS_mono_regular">{command}</pre>
              </Button>
              <Button onClick={handleCopyClick} size="2" variant="solid">
                <div>
                  {copied ? (
                    <FaCircleCheck
                      width="16"
                      height="16"
                      className="text-emerald-400"
                    />
                  ) : (
                    <FaCopy width="16" height="16" />
                  )}
                </div>
              </Button>
              <Button size="2" variant="soft" onClick={toggleCode} >
                <Cross1Icon />
              </Button>
            </Flex>
          </Box>
        </Flex>
      </Box>
    </>
  );
}
