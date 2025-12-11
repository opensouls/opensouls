import { Text, Flex, Box, Button } from "@radix-ui/themes";
import { FaCopy } from "react-icons/fa";
import { FaCircleCheck, FaRocket } from "react-icons/fa6";
import { useState } from "react";
import { Cross1Icon } from "@radix-ui/react-icons";
import "./Header.css";

export default function DeployButton({
  organizationSlug,
  subroutineId,
}: {
  organizationSlug: string;
  subroutineId: string;
}) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = `import { Soul, said } from "@opensouls/soul"
 
const soul = new Soul({
  organization: "${organizationSlug}",
  blueprint: "${subroutineId}",
})
 
soul.on("says", async ({ content }) => {
  console.log("Soul said", await content())
})
 
soul.connect().then(async () => {
  soul.dispatch(said("User", "Hi!"))
});`

  const handleCopyClick = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCode = () => setShowCode((prev) => !prev);

  return (
    <>
      {/* Deploy Button */}
      <Button onClick={toggleCode} size="2" variant="soft" className="disappear-when-tiny" mx="2">
        <FaRocket width="16" height="16" />
        Deploy
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
              padding: "20px",
              borderRadius: "4px",
            }}
          >
            {/* Copy Button and Close */}
            <Flex align="center" justify="between">
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

                <Text className="">Soul Snippet</Text>
              </Button>
              <Button size="2" variant="soft" onClick={toggleCode} >
                <Cross1Icon />
              </Button>
            </Flex>
            <div className="border p-8 mt-4 rounded-lg border-zinc-600">
              <pre className="text-sm font-OS_mono_regular">{snippet}</pre>
            </div>
          </Box>
        </Flex>
      </Box>
    </>
  );
}
