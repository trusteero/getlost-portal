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

// SignOut needs special handling to ensure it works correctly
// This wrapper ensures the client is initialized before calling signOut
export async function signOut() {
  if (typeof window === "undefined") {
    console.warn("signOut called on server side - this should only be called from client components");
    return;
  }

  const client = getAuthClient();
  if (!client) {
    console.error("Auth client not available for sign out");
    // Even if client isn't available, try to clear cookies
    clearAuthCookies();
    return;
  }
  
  try {
    console.log("🔄 [Auth] Signing out...");
    // Call the actual signOut method from Better Auth
    const result = await client.signOut();
    console.log("✅ [Auth] Sign out successful");
    return result;
  } catch (error) {
    console.error("❌ [Auth] Error during sign out:", error);
    // Even on error, try to clear cookies as fallback
    clearAuthCookies();
    throw error;
  }
}

// Helper function to clear auth cookies as fallback
function clearAuthCookies() {
  if (typeof window === "undefined") return;
  
  // Clear Better Auth cookies
  const cookiesToClear = [
    "better-auth.session_token",
    "better-auth.session",
    "better-auth.refresh_token",
  ];
  
  cookiesToClear.forEach((cookieName) => {
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`;
  });
  
  // Also clear all cookies for the domain as fallback
  document.cookie.split(";").forEach((c) => {
    const cookieName = c.split("=")[0]?.trim();
    if (cookieName && (cookieName.includes("auth") || cookieName.includes("session"))) {
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`;
    }
  });
}
