"use server"
import { Box, Button, Container, Flex, Text, Separator } from "@radix-ui/themes";
import { NextPage } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa6";

const WaitlistPage: NextPage<{ searchParams: { next: string } }> = async ({ searchParams }) => {
  return (
    <Container
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        backgroundImage: 'url("images/auth_forest.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Flex
        justify="center"
        align="center"
        style={{ width: "100%", height: "100vh" }}
      >
        <Box
          style={{
            position: "absolute",
            width: 400,
            height: 480,
            backgroundColor: "rgba(23, 22, 33, 0.80)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: "4px",
            border: "1px solid rgba(23, 22, 33, 0.48)",
            boxShadow: "0px 4px 10px rgba(23, 22, 33, 0.48)",
            padding: "0 40px",
          }}
        >
          <Flex direction="column" align="center">
            <Image
              src="/logo_mark.svg"
              width={30}
              height={38}
              // style={{ marginTop: "-10px" }}
              alt="Open Souls logo"
            />
            <Image
              src="/logo_type.svg"
              width={130}
              height={13}
              style={{ paddingTop: "16px" }}
              alt="Open Souls logo"
            />
            <Text
              style={{
                marginTop: 2,
                fontSize: 36,
                color: "var(--gray-11)",
                fontFamily: "CabinetGrotesk-Bold",
                whiteSpace: "nowrap",
              }}
            >
              Soul Engine
            </Text>

            <div className="fadeIn ml-4 mr-4 flex justify-center cursor-pointer">
              <Button
                className="cursor-pointer bg-blue-500 rounded-sm mt-8 text-sm whitespace-nowrap"
                asChild
              >
                <Link href="https://discord.gg/opensouls">
                  <FaDiscord />
                  Join Discord
                </Link>
              </Button>
            </div>

            <div style={{ width: "100%", marginTop: "30px", marginBottom: "10px" }}>
              <Separator style={{ width: "100%" }} />
            </div>

            <Text mt="4" align="center" size="2" style={{ color: "var(--gray-11)"}}>
              {`If you think you're seeing this screen in error, please reach out on Discord.`}
            </Text>
          </Flex>
        </Box>
      </Flex>
    </Container>
  )
}

export default WaitlistPage
