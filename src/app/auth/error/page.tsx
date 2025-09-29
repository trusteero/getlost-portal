"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: "Server Configuration Error",
      description: "There is a problem with the server configuration. Please contact support."
    },
    AccessDenied: {
      title: "Access Denied",
      description: "You do not have permission to sign in."
    },
    Verification: {
      title: "Unable to Verify",
      description: "The verification token has expired or has already been used."
    },
    OAuthSignin: {
      title: "OAuth Sign-in Error",
      description: "Error occurred while trying to authenticate with the OAuth provider. Please try again."
    },
    OAuthCallback: {
      title: "OAuth Callback Error",
      description: "Error in handling the response from the OAuth provider. Please ensure your account is properly configured."
    },
    OAuthCreateAccount: {
      title: "Account Creation Failed",
      description: "Could not create an account using OAuth. Please try a different sign-in method."
    },
    EmailCreateAccount: {
      title: "Account Creation Failed",
      description: "Could not create an account. An account may already exist with this email."
    },
    Callback: {
      title: "Callback Error",
      description: "Error occurred during authentication callback. Please try again."
    },
    OAuthAccountNotLinked: {
      title: "Account Not Linked",
      description: "This email is already associated with another account. Please sign in using your original sign-in method."
    },
    Default: {
      title: "Authentication Error",
      description: "An error occurred during authentication. Please try again."
    }
  };

  const errorInfo = errorMessages[error as keyof typeof errorMessages] || errorMessages.Default;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-cyan-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <CardTitle className="text-red-900">{errorInfo?.title || "Authentication Error"}</CardTitle>
          </div>
          <CardDescription>{errorInfo?.description || "An error occurred during authentication. Please try again."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
              Error code: {error}
            </div>
          )}

          <div className="space-y-2">
            <Link href="/login" className="block">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                Try Again
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="outline" className="w-full">
                Go to Homepage
              </Button>
            </Link>
          </div>

          <div className="text-sm text-gray-600">
            <p className="font-semibold mb-1">Common issues:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Make sure cookies are enabled in your browser</li>
              <li>Try clearing your browser cache and cookies</li>
              <li>Ensure you're using the same email for all sign-in methods</li>
              <li>Check if your Google account permissions are properly set</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}