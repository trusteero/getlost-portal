"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <Button
      variant="outline"
      className="border-gray-300"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.href = "/";
      }}
    >
      Sign out
    </Button>
  );
}