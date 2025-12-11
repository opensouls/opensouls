import { Box } from "@radix-ui/themes";
import Image from "next/image";
import Link from "next/link";
import DeployButton from "./DeployButton";
import "./Header.css";
import LoggedUserDropdownMenu from "./LoggedUserDropdownMenu";
import NewSoulButtonSmall from "./NewSoulButtonSmall";

export default function Header({ organizationSlug, subroutineId }: { organizationSlug: string; subroutineId: string }) {
  return (
    <div className="fixed h-16 overscroll-none overflow-hidden w-full">
      <div
        className="flex justify-between align-middle pl-6"
        style={{
          borderBottom: "1px solid var(--slate-4)",
          paddingTop: "10px",
          paddingBottom: "8px",
          marginRight: "50px",
        }}
      >
        <Image src="/logo_horizontal.svg" width={140} height={24} alt="Logo" />
        <div className="flex justify-center align-middle pr-4">
          <Link
            className="disappear-when-small pt-1 pl-2 pr-4 cursor-pointer bord text-md font-OS_bold decoration-none"
            href="https://docs.souls.chat"
            style={{
              color: "var(--slate-11)",
            }}
          >
            Documentation
          </Link>

          <Link
            className="disappear-when-small pt-1 pl-2 pr-6 cursor-pointer bord text-md font-OS_bold decoration-none"
            href="https://docs.souls.chat/getting-started/learn-by-example"
            style={{
              color: "var(--slate-11)",
            }}
          >
            Souls
          </Link>
          <DeployButton organizationSlug={organizationSlug} subroutineId={subroutineId} />
          <NewSoulButtonSmall />
          <Box
            ml="0"
            mr="4"
            style={{
              width: "1px",
              height: "32px",
              backgroundColor: "var(--slate-4)",
            }}
          />

          <LoggedUserDropdownMenu organizationSlug={organizationSlug} />
        </div>
      </div>
    </div>
  );
}
