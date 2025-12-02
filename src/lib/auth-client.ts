"use client";

import { createAuthClient } from "better-auth/react";
import type { Auth } from "./auth";

// Get the base URL - in browser use current origin, otherwise use env var or default
function getBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});

// Export hooks for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  updateUser,
  deleteUser,
  forgetPassword,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
  linkSocial,
  unlinkAccount,
} = authClient;