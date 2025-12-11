"use client";
import React, { useCallback } from "react";
import Image from "next/image";
import SoulEngineInit from "@/components/SoulEngineInit";
import BackgroundImage from "@/components/BackgroundImage";
import { useHover } from "@uidotdev/usehooks";
import { useMediaQuery } from "usehooks-ts";

export default function Home() {

  const [hoverRef, isHovered] = useHover();

  const useBackground = false;

  const backgrounds = [
    '/images/SoulsHeroCabin.jpg',
    '/images/SoulsHeroBubbles.jpg',
    '/images/SoulsHeroCircles.jpg',
  ]

  const [background,] = React.useState(backgrounds[Math.floor(Math.random() * backgrounds.length)]);
  const bg = useBackground ? <BackgroundImage imageUrl={background} /> : null;
  const gradient = useBackground ? 'bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,.25)_0%,_rgba(0,0,0,0)_75%)]' : '';
  const isSmallDevice = useMediaQuery("only screen and (max-width : 768px)", {initializeWithValue: true});

  function openDocs() {
    window.open('https://docs.souls.chat/', '_self');
  }

  const openMobile = useCallback(() => {

    //gives time for animation to play
    let timeout = null;
    if (isSmallDevice) {
      timeout = setTimeout(openDocs, 400);
    } else {
      openDocs();
    }
    return timeout ? () => clearTimeout(timeout) : null;

  }, [isSmallDevice]);



  return (
    <div className="fixed w-screen h-screen bg-black select-none overflow-hidden">
      {bg}
      <div className={`flex h-[100vh] flex-col items-center justify-center select-none duration-500 bg-black ${isHovered && useBackground ? 'bg-opacity-10 backdrop-blur-lg' : 'bg-opacity-0'} overflow-hidden`}>

        <div className="fadeIn absolute flex flex-col align-middle justify-center items-center w-64 h-64 sm:w-72 sm:h-72">

          <div className={`absolute m-auto w-full h-full border border-white animate-pulse duration-200 rounded-full ${isHovered ? 'border-opacity-0' : 'border-opacity-50'} ${gradient} z-0` } />
          <div className="absolute mx-auto z-10">
            <Image
              className={`m-auto duration-200 ${isHovered ? 'blur-none translate-y-[-3em] opacity-100' : 'blur-2xl translate-y-[0em] opacity-0'}`}
              src="/images/GlimmerAlpha.png"
              width={250}
              height={250}
              alt="Glimmer"
            />
          </div>

          <div className="absolute m-2 z-50 pointer-events-auto scale-75 sm:scale-100">
            <button className={`flex flex-col gap-2 p-6 items-center justify-center duration-100 drop-shadow-md ${isHovered ? 'opacity-100 scale-95' : 'opacity-90'}`}
              ref={hoverRef}
              onClick={() => { openMobile() }}
            >
              <Image
                className="ml-4 mr-4 pb-2"
                src="/logo_mark.svg"
                width={25}
                height={25}
                alt="Open Souls logo"
              />
              <Image
                className="ml-4 mr-4 pb-2 "
                src="/logo_type.svg"
                width={140}
                height={15}
                alt="Open Souls logo"
              />
            </button>

          </div>

          {/* <button
            className="flex flex-row items-center mx-auto gap-2 mt-1 justify-center font-OS_regular text-2xl text-zinc-300 hover:text-zinc-200"
            onClick={() => { open('https://docs.souls.chat/', '_blank') }}
          >
            Soul Engine
          </button> */}
        </div>
      </div>
    </div>

  );
}
