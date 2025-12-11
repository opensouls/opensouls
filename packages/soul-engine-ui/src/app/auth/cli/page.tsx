import "server-only";

import CopyButton from "@/components/CopyButton";
import { Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { NextPage } from "next";

const AuthCliPage: NextPage = async () => {
  const tokenPayload = {
    apiKey: "local-insecure-key",
    organization: { slug: "local", name: "Local" },
    user: { email: "local@example.com", id: "local-user" },
  };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");

  return (
    <Container>
      <Flex direction="column" gap="4" height="100%" width="100%" align="center" justify="center" mt="9">
        <Heading>Local CLI login disabled</Heading>
        <Text size="2">Use the bundled default config for local-only mode.</Text>
        <Box width="100%">
          <CopyButton token={token} />
          <Text>{token}</Text>
        </Box>
      </Flex>
    </Container>
  );
};

export default AuthCliPage;
