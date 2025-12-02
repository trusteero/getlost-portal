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

// Create a proxy that always returns an object with methods, never undefined
function createSignInProxy() {
  return new Proxy({} as any, {
    get(_target, prop) {
      // Always try to get fresh client reference (lazy evaluation)
      const client = getAuthClient();
      
      if (!client) {
        // Client not initialized - return a no-op function
        // This ensures signIn.email exists as a function
        console.warn("[Auth] Client not initialized, returning no-op for signIn." + String(prop));
        return () => Promise.resolve({ 
          error: { 
            message: "Auth client not available. Please refresh the page.",
            code: "CLIENT_NOT_INITIALIZED"
          } 
        });
      }
      
      const signInObj = client.signIn;
      if (!signInObj) {
        // signIn object not available - return a no-op function
        console.warn("[Auth] signIn object not available, returning no-op for signIn." + String(prop));
        return () => Promise.resolve({ 
          error: { 
            message: "Sign in not available. Please refresh the page.",
            code: "SIGNIN_NOT_AVAILABLE"
          } 
        });
      }
      
      const method = signInObj[prop as keyof typeof signInObj];
      
      if (method === undefined || method === null) {
        // Method doesn't exist - return a no-op function
        console.warn(`[Auth] signIn.${String(prop)} not found, returning no-op`);
        return () => Promise.resolve({ 
          error: { 
            message: `Sign in method ${String(prop)} not available.`,
            code: "METHOD_NOT_AVAILABLE"
          } 
        });
      }
      
      // If it's a function, bind it to the signInObj
      if (typeof method === "function") {
        return method.bind(signInObj);
      }
      
      // Return the property value as-is
      return method;
    },
  });
}

function createSignUpProxy() {
  return new Proxy({} as any, {
    get(_target, prop) {
      const client = getAuthClient();
      
      if (!client) {
        return () => Promise.resolve({ 
          error: { 
            message: "Auth client not available. Please refresh the page.",
            code: "CLIENT_NOT_INITIALIZED"
          } 
        });
      }
      
      const signUpObj = client.signUp;
      if (!signUpObj) {
        return () => Promise.resolve({ 
          error: { 
            message: "Sign up not available. Please refresh the page.",
            code: "SIGNUP_NOT_AVAILABLE"
          } 
        });
      }
      
      const method = signUpObj[prop as keyof typeof signUpObj];
      
      if (method === undefined || method === null) {
        return () => Promise.resolve({ 
          error: { 
            message: `Sign up method ${String(prop)} not available.`,
            code: "METHOD_NOT_AVAILABLE"
          } 
        });
      }
      
      if (typeof method === "function") {
        return method.bind(signUpObj);
      }
      
      return method;
    },
  });
}

// Export methods directly for convenience (preserving structure)
// Note: signIn and signUp are wrapped in proxies to ensure nested methods work
// This ensures signIn.email() and signIn.social() work correctly
export const signIn = createSignInProxy();
export const signUp = createSignUpProxy();

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
