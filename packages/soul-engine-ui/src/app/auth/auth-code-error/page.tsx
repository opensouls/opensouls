
"use server"
import { Box, Container, Heading } from "@radix-ui/themes";
import { NextPage } from "next";

const AuthPage:NextPage<{ searchParams: { next: string } }> = async () => {
  return (
    <Container style={{
      position: 'fixed',
      width: '100vw',
      height: '100vh',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      backgroundImage: 'url("/login_asset.png")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <Box>
        <Heading>There was a problem with your auth.</Heading>
      </Box>
    </Container>
  )
}

export default AuthPage
