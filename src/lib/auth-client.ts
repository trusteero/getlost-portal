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

// Helper to create a proxy for nested objects (like signIn with .email, .social)
function createNestedProxy(getValue: () => any) {
  return new Proxy({}, {
    get(_target, nestedProp) {
      const value = getValue();
      if (!value) {
        // Return a no-op function if value is not available
        return () => Promise.resolve({ error: { message: "Auth client not available" } });
      }
      
      const nestedValue = value[nestedProp as keyof typeof value];
      
      // If it's a function, bind it to the value (which might be an object with methods)
      if (typeof nestedValue === "function") {
        return nestedValue.bind(value);
      }
      
      return nestedValue;
    },
  });
}

// Export client for direct access - this preserves the original structure
// (e.g., signIn.email(), signIn.social(), etc.)
export const authClient = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(_target, prop) {
    const client = getAuthClient();
    if (!client) {
      // During SSR, return appropriate defaults or proxies
      if (prop === "useSession") {
        return () => ({ data: null, isPending: true });
      }
      // For objects with nested methods (like signIn), return a proxy
      if (prop === "signIn" || prop === "signUp") {
        return createNestedProxy(() => null);
      }
      // Return a no-op function for other methods
      return () => Promise.resolve({ error: { message: "Auth client not available" } });
    }
    
    const value = client[prop as keyof typeof client];
    
    // If it's a function, bind it to the client
    if (typeof value === "function") {
      return value.bind(client);
    }
    
    // If it's an object with nested methods (like signIn.email, signIn.social),
    // wrap it in a proxy to ensure nested access works
    if (value && typeof value === "object" && (prop === "signIn" || prop === "signUp")) {
      return createNestedProxy(() => value);
    }
    
    // Return other objects as-is
    return value;
  },
});

// Helper to get signIn object from client
function getSignIn() {
  const client = getAuthClient();
  return client?.signIn || null;
}

// Helper to get signUp object from client  
function getSignUp() {
  const client = getAuthClient();
  return client?.signUp || null;
}

// Create signIn base object with explicit methods that Turbopack can statically analyze
// These are defined as direct properties so they're always visible to static analysis
const signInBase = {
  email: async (params: any) => {
    const signInObj = getSignIn();
    if (!signInObj?.email) {
      console.warn("[Auth] signIn.email not available");
      return { error: { message: "Auth client not available. Please refresh the page.", code: "CLIENT_NOT_INITIALIZED" } };
    }
    return signInObj.email(params);
  },
  
  social: async (params: any) => {
    const signInObj = getSignIn();
    // Use type assertion to access social method which may exist at runtime
    const signInAny = signInObj as any;
    if (!signInAny?.social) {
      console.warn("[Auth] signIn.social not available");
      return { error: { message: "Auth client not available. Please refresh the page.", code: "CLIENT_NOT_INITIALIZED" } };
    }
    return signInAny.social(params);
  },
};

// Use Proxy as fallback for any other properties that might exist
export const signIn = new Proxy(signInBase, {
  get(target, prop) {
    // First check if property exists in target (email, social)
    if (prop in target) {
      return (target as any)[prop];
    }
    // Otherwise, get it from the actual signIn object from Better Auth
    const signInObj = getSignIn();
    if (signInObj && prop in signInObj) {
      const value = (signInObj as any)[prop];
      if (typeof value === "function") {
        return value.bind(signInObj);
      }
      return value;
    }
    return undefined;
  },
}) as any;

// Create signUp base object with explicit methods
const signUpBase = {
  email: async (params: any) => {
    const signUpObj = getSignUp();
    if (!signUpObj?.email) {
      console.warn("[Auth] signUp.email not available");
      return { error: { message: "Auth client not available. Please refresh the page.", code: "CLIENT_NOT_INITIALIZED" } };
    }
    return signUpObj.email(params);
  },
  
  social: async (params: any) => {
    const signUpObj = getSignUp();
    // Use type assertion to access social method which may exist at runtime
    const signUpAny = signUpObj as any;
    if (!signUpAny?.social) {
      console.warn("[Auth] signUp.social not available");
      return { error: { message: "Auth client not available. Please refresh the page.", code: "CLIENT_NOT_INITIALIZED" } };
    }
    return signUpAny.social(params);
  },
};

export const signUp = new Proxy(signUpBase, {
  get(target, prop) {
    if (prop in target) {
      return (target as any)[prop];
    }
    const signUpObj = getSignUp();
    if (signUpObj && prop in signUpObj) {
      const value = (signUpObj as any)[prop];
      if (typeof value === "function") {
        return value.bind(signUpObj);
      }
      return value;
    }
    return undefined;
  },
}) as any;

export const {
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
