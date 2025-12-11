"use client";
import DebugChat from "@/components/DebugChat";
import { Box, Grid, Text } from "@radix-ui/themes";
import { NextPage } from "next";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import VerticalSidebar from "@/components/VerticalSidebar";

const ChatPage: NextPage<{
  params: { organizationSlug?: string; chatId?: string };
}> = () => {
  const { chatId, subroutineId, organizationSlug } = useParams();

  if (!chatId || !subroutineId || !organizationSlug) {
    return <Text>Missing one of chatId, subroutineId or orgnaization</Text>;
  }

  return (
    <Grid
      className="h-screen w-screen overflow-hidden"
      gap="0"
      style={{
        gridTemplateColumns: "50px 1fr",
        gridTemplateRows: "50px 1fr",
      }}
    >
      <Box
        style={{
          gridColumn: "1 / 2",
          gridRow: "1 / 3",
        }}
      >
        <VerticalSidebar text="Inspector" />
      </Box>
      <Box
        style={{
          gridColumn: "2 / 3",
          gridRow: "1 / 2",
          zIndex: 10,
        }}
      >
        <Header
          organizationSlug={organizationSlug as string}
          subroutineId={subroutineId as string}
        />
      </Box>
      <Box
        style={{
          gridColumn: "2 / 3",
          gridRow: "2 / 3",
          zIndex: 0,
        }}
      >
        <DebugChat
          chatId={chatId as string}
          organizationSlug={organizationSlug as string}
          subroutineId={subroutineId as string}
        />
      </Box>
    </Grid>
  );
};

export default ChatPage;
