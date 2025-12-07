"use client";

import { createAuthClient } from "better-auth/react";

// Get the base URL - in browser use current origin, otherwise use env var or default
function getBaseURL(): string {
  if (typeof window !== "undefined") {
    // Ensure we always return a string, never a Promise
    const origin = window.location.origin;
    if (typeof origin === "string") {
      return origin;
    }
  }
  // Fallback to env var or default - ensure it's a string
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof envUrl === "string" && envUrl) {
    return envUrl;
  }
  return "http://localhost:3000";
}

// Initialize client immediately when module loads (client-side only)
// This ensures it's available synchronously
let _authClient: ReturnType<typeof createAuthClient> | null = null;

function initializeAuthClient() {
  if (typeof window === "undefined") {
    return null;
  }
  
  if (_authClient) {
    return _authClient;
  }
  
  // Ensure baseURL is definitely a string, not a Promise
  const baseURL = getBaseURL();
  if (typeof baseURL !== "string") {
    console.error("[Auth Client] baseURL is not a string:", baseURL);
    return null;
  }
  
  try {
    // Initialize with just baseURL - Better Auth will handle the rest
    // Use a simple string literal to avoid any Promise issues
    const config = {
      baseURL: String(baseURL), // Explicitly convert to string
    };
    console.log("[Auth Client] Initializing with baseURL:", config.baseURL);
    _authClient = createAuthClient(config);
    console.log("[Auth Client] Successfully initialized");
    return _authClient;
  } catch (error) {
    console.error("[Auth Client] Failed to create auth client:", error);
    return null;
  }
}

function getAuthClient() {
  // During SSR, we can't use the client
  if (typeof window === "undefined") {
    return null;
  }
  
  // Initialize if not already initialized
  if (!_authClient) {
    return initializeAuthClient();
  }
  
  return _authClient;
}

// Initialize on module load (client-side only)
if (typeof window !== "undefined") {
  // Use a microtask to ensure window is fully available
  Promise.resolve().then(() => {
    initializeAuthClient();
  });
}

// Export useSession hook directly - it needs special handling
export function useSession() {
  const client = getAuthClient();
  if (!client) {
    // During SSR, return a safe default
    if (typeof window === "undefined") {
      return { data: null, isPending: true };
    }
    // Client-side but client failed to initialize - log error
    console.error("[Auth Client] useSession called but client is null");
    return { data: null, isPending: false, error: "Auth client not initialized" };
  }
  
  try {
    const sessionResult = client.useSession();
    // Add error logging if session is stuck in pending
    if (sessionResult.isPending && typeof window !== "undefined") {
      setTimeout(() => {
        if (sessionResult.isPending) {
          console.warn("[Auth Client] useSession stuck in pending state for >5s");
        }
      }, 5000);
    }
    return sessionResult;
  } catch (error) {
    console.error("[Auth Client] Error in useSession:", error);
    return { data: null, isPending: false, error: String(error) };
  }
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

// Export client directly - Better Auth needs direct access to its internal properties
// Initialize immediately on client-side to avoid Proxy interference
let _exportedClient: ReturnType<typeof createAuthClient> | null = null;

if (typeof window !== "undefined") {
  // Initialize on client-side immediately
  _exportedClient = initializeAuthClient();
}

// Export the client directly - no Proxy to avoid interfering with Better Auth's internal property access
export const authClient = _exportedClient || (() => {
  // SSR fallback - return a minimal object
  return {
    useSession: () => ({ data: null, isPending: true }),
    signIn: {
      email: () => Promise.resolve({ error: { message: "Auth client not available" } }),
      social: () => Promise.resolve({ error: { message: "Auth client not available" } }),
    },
    signUp: {
      email: () => Promise.resolve({ error: { message: "Auth client not available" } }),
      social: () => Promise.resolve({ error: { message: "Auth client not available" } }),
    },
    getSession: () => Promise.resolve(null),
    signOut: () => Promise.resolve({ error: { message: "Auth client not available" } }),
  } as any;
})();

// Export signIn and signUp - access them directly from the client to avoid double-proxying
// This gets the actual Better Auth objects without additional proxy layers
export const signIn = new Proxy({}, {
  get(_target, prop) {
    const client = getAuthClient();
    if (!client || !client.signIn) {
      // Return fallback if client not initialized
      if (prop === "email" || prop === "social") {
        return async (params: any) => {
          console.warn(`[Auth] signIn.${String(prop)} not available - client not initialized`);
          return { error: { message: "Auth client not available. Please refresh the page.", code: "CLIENT_NOT_INITIALIZED" } };
        };
      }
      return undefined;
    }
    // Return the property directly from the actual signIn object
    return (client.signIn as any)[prop];
  },
}) as any;

export const signUp = new Proxy({}, {
  get(_target, prop) {
    const client = getAuthClient();
    if (!client || !client.signUp) {
      // Return fallback if client not initialized
      if (prop === "email" || prop === "social") {
        return async (params: any) => {
          console.warn(`[Auth] signUp.${String(prop)} not available - client not initialized`);
          return { error: { message: "Auth client not available. Please refresh the page.", code: "CLIENT_NOT_INITIALIZED" } };
        };
      }
      return undefined;
    }
    // Return the property directly from the actual signUp object
    return (client.signUp as any)[prop];
  },
}) as any;

// Export methods individually to avoid destructuring issues with Proxy
// Destructuring from a Proxy at module load time can cause issues
// Using any[] for parameters since we're just passing them through to the actual client
// Type assertion needed for spread operator with any[]
export const getSession = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve(null);
  return (client.getSession as any)(...args);
};

export const updateUser = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.updateUser as any)(...args);
};

export const deleteUser = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.deleteUser as any)(...args);
};

export const forgetPassword = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.forgetPassword as any)(...args);
};

export const resetPassword = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.resetPassword as any)(...args);
};

export const verifyEmail = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.verifyEmail as any)(...args);
};

export const sendVerificationEmail = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.sendVerificationEmail as any)(...args);
};

export const linkSocial = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.linkSocial as any)(...args);
};

export const unlinkAccount = (...args: any[]) => {
  const client = getAuthClient();
  if (!client) return Promise.resolve({ error: { message: "Auth client not available" } });
  return (client.unlinkAccount as any)(...args);
};

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
    
    // First, clear cookies proactively
    clearAuthCookies();
    
    // Call the actual signOut method from Better Auth
    const result = await client.signOut();
    console.log("✅ [Auth] Sign out successful");
    
    // Clear cookies again after signOut to ensure they're gone
    clearAuthCookies();
    
    // Wait a moment to ensure cookies are cleared
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Clear one more time for good measure
    clearAuthCookies();
    
    return result;
  } catch (error) {
    console.error("❌ [Auth] Error during sign out:", error);
    // Even on error, try to clear cookies as fallback
    clearAuthCookies();
    // Don't throw - allow redirect to proceed
  }
}

// Helper function to clear auth cookies as fallback
function clearAuthCookies() {
  if (typeof window === "undefined") return;
  
  // Clear Better Auth cookies - try all possible variations
  const cookiesToClear = [
    "better-auth.session_token",
    "better-auth.session-token",
    "better-auth_session_token",
    "better-auth_session-token",
    "better-auth.session",
    "better-auth.refresh_token",
    "better-auth.refresh-token",
    // Also try without prefix
    "session_token",
    "session-token",
    "refresh_token",
    "refresh-token",
  ];
  
  const domain = window.location.hostname;
  const hostnameParts = domain.split('.');
  
  cookiesToClear.forEach((cookieName) => {
    // Clear with path=/
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    // Clear with domain
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${domain};`;
    // Clear with .domain (for subdomains)
    if (hostnameParts.length > 1) {
      const rootDomain = '.' + hostnameParts.slice(-2).join('.');
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${rootDomain};`;
    }
    // Clear with secure flag
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;secure;`;
    // Clear with sameSite
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;sameSite=Lax;`;
    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;sameSite=Strict;`;
  });
  
  // Also clear all cookies for the domain as fallback
  const allCookies = document.cookie.split(";");
  allCookies.forEach((c) => {
    const cookieName = c.split("=")[0]?.trim();
    if (cookieName && (cookieName.includes("auth") || cookieName.includes("session") || cookieName.includes("token"))) {
      // Clear with various options
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${domain};`;
      if (hostnameParts.length > 1) {
        const rootDomain = '.' + hostnameParts.slice(-2).join('.');
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${rootDomain};`;
      }
    }
  });
  
  console.log("🧹 [Auth] Cleared all auth cookies");
}
