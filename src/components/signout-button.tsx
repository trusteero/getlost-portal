"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export default function SignOutButton() {
  return (
    <Button
      variant="outline"
      className="border-gray-300"
      onClick={async () => {
        await signOut();
        window.location.href = "/";
      }}
    >
      Sign out
    </Button>
  );
}