"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MagicVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (token) {
      verifyMagicLink(token);
    } else {
      setStatus("error");
      setMessage("No verification token provided");
    }
  }, [token]);

  const verifyMagicLink = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/magic-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok && data.email) {
        // Sign the user in using NextAuth
        const result = await signIn("credentials", {
          redirect: false,
          email: data.email,
          password: `magic:${token}`, // Special password format for magic links
        });

        if (result?.ok) {
          setStatus("success");
          setMessage("Sign in successful! Redirecting...");
          setTimeout(() => {
            router.push("/dashboard");
          }, 2000);
        } else {
          setStatus("error");
          setMessage("Failed to complete sign in");
        }
      } else {
        setStatus("error");
        setMessage(data.error || "Invalid or expired magic link");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage("An error occurred during verification");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="w-12 h-12 text-green-600" />
            )}
            {status === "error" && (
              <XCircle className="w-12 h-12 text-red-600" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Verifying Magic Link"}
            {status === "success" && "Success!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription className="mt-2">
            {status === "loading" && "Please wait while we sign you in..."}
            {status === "success" && message}
            {status === "error" && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "error" && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Magic links expire after 1 hour. Please request a new one if needed.
              </p>
              <Link href="/login">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Back to Login
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}