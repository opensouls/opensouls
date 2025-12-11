"use client";

import * as Avatar from "@radix-ui/react-avatar";
import { DropdownMenu } from "@radix-ui/themes";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TbLogout2 } from "react-icons/tb";
import "./Header.css";
import { GroupIcon, HomeIcon, BookmarkIcon } from "@radix-ui/react-icons";
import { getLocalUser, signOutLocal } from "@/lib/localAuth";

export default function LoggedUserDropdownMenu({ organizationSlug }: { organizationSlug: string }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | undefined>();
  useEffect(() => {
    const loadAvatar = async () => {
      const user = await getLocalUser();
      setAvatar(user.user_metadata.avatar_url as string | undefined);
    };
    loadAvatar();
  }, []);

  const handleSignOut = async () => {
    await signOutLocal();

    router.push("/");
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Avatar.Root>
          <Avatar.Image
            src={avatar}
            alt="Profile img"
            style={{
              width: 32,
              height: 32,
              borderRadius: 50,
              cursor: "pointer",
            }}
          />
        </Avatar.Root>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="w-40">
        <DropdownMenu.Item>
          <Link href={`/souls/${organizationSlug}`} className="flex gap-2 items-center">
            <Image src="/icons/soul_smile.svg" width={16} height={16} alt="View my souls" />
            <span>My Souls</span>
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <Link href={`/room/${organizationSlug}`} className="flex gap-2 items-center">
            <GroupIcon />
            <span>Editor</span>
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <Link href={`https://docs.souls.chat/`} className="flex gap-2 items-center">
            <BookmarkIcon />
            <span>Docs</span>
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          <Link href={`/home/${organizationSlug}`} className="flex gap-2 items-center">
            <HomeIcon />
            <span>Home</span>
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={handleSignOut}>
          <div className="flex gap-2 items-center">
            <TbLogout2 size={16} />
            Sign Out
          </div>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
