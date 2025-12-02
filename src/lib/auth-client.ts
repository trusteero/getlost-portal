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

// Lazy initialization - only create client when actually needed
let _authClient: ReturnType<typeof createAuthClient> | null = null;

function getAuthClient() {
  // During SSR, we can't use the client, but we need to return something
  // that won't crash during build
  if (typeof window === "undefined") {
    return null;
  }
  
  if (!_authClient) {
    _authClient = createAuthClient({
      baseURL: getBaseURL(),
    });
  }
  
  return _authClient;
}

// Export useSession hook directly - it needs special handling
export function useSession() {
  const client = getAuthClient();
  if (!client) {
    // During SSR, return a safe default
    return { data: null, isPending: true };
  }
  return client.useSession();
}

// Export client for direct access - this preserves the original structure
// (e.g., signIn.email(), signIn.social(), etc.)
export const authClient = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(_target, prop) {
    const client = getAuthClient();
    if (!client) {
      // During SSR, return a proxy that mimics the structure
      if (prop === "useSession") {
        return () => ({ data: null, isPending: true });
      }
      // Return a proxy for nested objects like signIn.email
      return new Proxy({}, {
        get() {
          return () => {
            if (typeof window !== "undefined") {
              console.warn("Auth client not initialized");
            }
            return Promise.resolve({ error: { message: "Auth client not available" } });
          };
        },
      });
    }
    const value = client[prop as keyof typeof client];
    
    // If it's a function, bind it to the client
    if (typeof value === "function") {
      return value.bind(client);
    }
    
    // If it's an object (like signIn with .email, .social methods), return it as-is
    return value;
  },
});

// Export methods directly for convenience (preserving structure)
export const {
  signIn,
  signUp,
  signOut,
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
