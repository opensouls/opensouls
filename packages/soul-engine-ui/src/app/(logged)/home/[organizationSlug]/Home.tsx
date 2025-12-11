"use client";

import { useCallback, useState, useMemo } from "react";
import DebugChat from "@/components/DebugChat";
import { Theme, Box, Grid, Select, TextField, Badge, Button, Text, ScrollArea } from "@radix-ui/themes";
import { Cross1Icon, PlusIcon, WidthIcon } from "@radix-ui/react-icons";
import VerticalSidebar from "@/components/VerticalSidebar";
import { SoulOpts } from "@opensouls/soul";
import { useSharedContext } from "@opensouls/react";
import { Json } from "@opensouls/core";

export const Home = ({ params }: {
    params: { organizationSlug: string },
}) => {
    const [hoveredLink, setHoveredLink] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const backgroundImages = useMemo(() => [
        "/images/SoulsHeroCabin.jpg",
        // "/images/SoulsHeroCircles.jpg",
        // "/images/SoulsHeroWater.jpg",
    ], []);

    const randomBackgroundImage = useMemo(() =>
        backgroundImages[Math.floor(Math.random() * backgroundImages.length)],
        [backgroundImages]);

    function handleHover(link: string) {
        setHoveredLink(link);
        setIsHovered(true);
    }
    function handleLeave() {
        setIsHovered(false);
    }
    return (
        <Theme>
            <div className="relative h-screen w-screen overflow-hidden font-OS_extrabold select-none" >
                <Box
                    style={{
                        gridColumn: "1 / 2",
                        gridRow: "1 / 3",
                    }}
                >
                    <VerticalSidebar text="Home" />
                </Box>
                <div className="absolute inset-0 bg-black opacity-100">
                    <img
                        className={`hidden w-full h-full object-cover transition-opacity duration-1000`}
                        src={randomBackgroundImage}
                        alt="background"
                    />
                </div>
                <Box className="relative px-24 py-24 w-full h-full flex flex-col justify-between">
                    <div className="absolute bottom-24 right-24 lg:top-24 lg:right-24">
                        <img className="w-12 h-12 lg:w-24 lg:h-24" src="/logo_mark.svg" alt="logo" />
                    </div>
                    <div className="flex flex-col gap-2 mb-12 max-w-[48em]">
                        <h1 className="text-[4em] leading-[.8em] lg:text-[8em] lg:leading-[.8em] font-bold select-none whitespace-pre-line overflow-hidden">
                            {`Welcome \n${params.organizationSlug}`}
                        </h1>
                    </div>

                    <div className="flex flex-col gap-1 w-min">
                        <Link href="/souls/create">Souls</Link>
                        <Link href={`/room/${params.organizationSlug}`}>Editor</Link>
                        <Link href="https://docs.souls.chat/">Docs</Link>
                    </div>

                    <div className="flex flex-col font-OS_extralight text-sm gap-1 opacity-75">
                        <p>2024 Open Souls</p>
                    </div>

                </Box>

            </div>
        </Theme>
    );
};

function Link({ children, href }: { children: React.ReactNode, href: string }) {
    return (
        <a
            href={href}
            className="group flex"
        >
            <span className="opacity-0 group-hover:opacity-100 mr-2 transition-opacity">
                →
            </span>
            {children}
        </a>
    )
}