"use client";
import { Button, Container } from "@radix-ui/themes";
import React, { useEffect } from "react";
import Image from "next/image";
import { setCookie } from "@/lib/setCookie";
import { FaGithub, FaDiscord } from "react-icons/fa6";

const Auth: React.FC<{ next?: string }> = ({ next }) => {
  useEffect(() => {
    if (!next) {
      return;
    }
    setCookie("afterLoginNext", next || "/");
  }, [next]);

  const completeLogin = () => {
    const redirectTo = next || "/";
    window.location.href = redirectTo;
  };

  const onGithubClick = async () => {
    completeLogin();
  };

  const onDiscordClick = async () => {
    completeLogin();
  };

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
        backgroundImage: 'url("images/auth_forest.webp")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex h-[100vh] flex-col items-center justify-center ">
        <div className="fadeIn m-2 border border-zinc-300/20 bg-zinc-700/10 p-4 pb-8 pt-8 shadow-xl backdrop-blur-sm min-w-[300px]">
          <div className="flex flex-col items-center justify-center">
            <Image
              className="ml-4 mr-4 pb-2"
              src="/logo_mark.svg"
              width={30}
              height={16}
              alt="Open Souls logo"
            />
            <Image
              className="ml-4 mr-4 pb-2 "
              src="/logo_type.svg"
              width={150}
              height={16}
              alt="Open Souls logo"
            />
            <div className="mt-1 flex justify-center font-OS_bold text-4xl text-zinc-300">
              Soul Engine
            </div>
          </div>
          <div className="fadeIn ml-4 mr-4 mt-4 flex justify-center cursor-pointer">
            <Button
              className="cursor-pointer bg-blue-500 rounded-sm mt-8 text-sm whitespace-nowrap"
              onClick={onDiscordClick}
            >
              <FaDiscord />
              Sign in with Discord
            </Button>
          </div>
          <div className="fadeIn ml-4 mr-4 mt-4 flex justify-center cursor-pointer">
            <Button
              className="cursor-pointer bg-blue-500 rounded-sm mt-8 text-sm whitespace-nowrap"
              onClick={onGithubClick}
            >
              <FaGithub />
              Sign in with GitHub
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default Auth;
