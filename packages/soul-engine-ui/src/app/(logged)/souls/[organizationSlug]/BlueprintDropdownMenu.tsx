"use client";

import { toggleJwtEnforcement } from "@/lib/actions/user/blueprintServerActions";
import { DropdownMenu, Checkbox, AlertDialog, Button } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BlueprintDropdownMenu({ blueprint, children }: { 
  blueprint: {
    slug: string;
    enforce_jwt: boolean;
  };
  children: React.ReactNode;
}) {
  const router = useRouter()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleToggleJwtEnforcement = async () => {
    if (blueprint.enforce_jwt) {
      setIsConfirmOpen(true);
      return;
    }

    await toggleJwtEnforcement(blueprint.slug, !blueprint.enforce_jwt);

    router.refresh()
  };

  const handleConfirmDisableJwt = async () => {
    await toggleJwtEnforcement(blueprint.slug, false);
    setIsConfirmOpen(false);

    router.refresh()
  };

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger className="focus:outline-none">
          {children}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={handleToggleJwtEnforcement}>
            <div className="flex items-center">
              <Checkbox checked={blueprint.enforce_jwt} />
              <span className="ml-2">Require JWT for authentication</span>
            </div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <AlertDialog.Root open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialog.Content>
          <AlertDialog.Title>Disable JWT Requirement</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to disable JWT requirement for this blueprint? This will make the souls created from this blueprint accessible without authentication.
          </AlertDialog.Description>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="solid" color="red" onClick={handleConfirmDisableJwt}>
                Disable JWT
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
