"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="sm:w-auto"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      {copy.dashboard.logout}
    </Button>
  );
}
