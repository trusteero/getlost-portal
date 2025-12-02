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
  // During SSR/build, return null - hooks won't work but won't crash
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

// Create a safe proxy that handles SSR gracefully
function createSafeProxy<T extends object>(factory: () => T | null): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const client = factory();
      if (!client) {
        // During SSR, return a no-op function or undefined
        // This prevents crashes during build/prerender
        return () => {
          if (typeof window !== "undefined") {
            console.warn("Auth client not initialized. This should only happen during SSR.");
          }
        };
      }
      const value = client[prop as keyof typeof client];
      
      // If it's a function, bind it to the client
      if (typeof value === "function") {
        return value.bind(client);
      }
      
      return value;
    },
  });
}

// Export the client - it will be lazily initialized on first use
export const authClient = createSafeProxy(getAuthClient);

// Export hooks and methods directly for convenience
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
