"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus("error");
      setMessage("No verification token provided");
    }
  }, [token]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/verify-email?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Email verified successfully!");

        // Redirect to login after 2 seconds since we need them to sign in
        setTimeout(() => {
          router.push("/login?verified=true");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to verify email");
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
            {status === "loading" && "Verifying Email"}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription className="mt-2">
            {status === "loading" && "Please wait while we verify your email address..."}
            {status === "success" && message}
            {status === "error" && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "success" && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Your email is verified! Please sign in to continue.
              </p>
              <Link href="/login">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          )}
          {status === "error" && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                If your token has expired, you can request a new verification email.
              </p>
              <Link href="/auth/resend-verification">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Resend Verification Email
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-cyan-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verifying Email</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-orange-600" />
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}