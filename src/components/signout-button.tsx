"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { useState } from "react";

export default function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      // Wait longer for cookies to be fully cleared
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Sign out error:", error);
      // Continue with redirect even if signOut fails
    } finally {
      // Force a hard redirect to login page with cache busting
      // Use replace to prevent back button from going to dashboard
      window.location.replace("/login?logout=true");
    }
  };

  return (
    <Button
      variant="outline"
      className="border-gray-300"
      onClick={handleSignOut}
      disabled={isLoading}
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </Button>
  );
}