"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function MagicVerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "oauth">("loading");
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
      } else if (data.error === "OAUTH_USER") {
        setStatus("oauth");
        setMessage(data.message || "This account uses Google sign-in");
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
            {status === "oauth" && (
              <AlertCircle className="w-12 h-12 text-blue-600" />
            )}
            {status === "error" && (
              <XCircle className="w-12 h-12 text-red-600" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Verifying Magic Link"}
            {status === "success" && "Success!"}
            {status === "oauth" && "Google Account Detected"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription className="mt-2">
            {status === "loading" && "Please wait while we sign you in..."}
            {status === "success" && message}
            {status === "oauth" && message}
            {status === "error" && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "oauth" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <p className="text-sm text-blue-800">
                  Your account was created using Google Sign-In. For security reasons,
                  you need to use Google to sign in to your account.
                </p>
              </div>
              <Button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </Button>
              <p className="text-sm text-gray-600">
                Or{" "}
                <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium">
                  go back to login
                </Link>
              </p>
            </div>
          )}
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

export default function MagicVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-cyan-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-orange-600" />
            <p className="mt-4 text-gray-600">Verifying your magic link...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <MagicVerifyContent />
    </Suspense>
  );
}