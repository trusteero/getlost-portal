import { auth } from "@/lib/auth";
import { headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Get the current session using Better Auth
 * This is cached per request
 */
export const getSession = cache(async () => {
  const headers = await getHeaders();
  return auth.api.getSession({
    headers: headers,
  });
});

/**
 * Get the current user from the session
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  return session?.user || null;
});

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Check if user is an admin
 */
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" || user?.role === "super_admin";
}

/**
 * Require admin access - redirects if not admin
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }
  return session;
}

// Re-export the auth instance for direct use
export { auth } from "@/lib/auth";
export { authClient } from "@/lib/auth-client";
