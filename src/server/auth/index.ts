import { auth } from "@/lib/auth";
import { headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { user } from "@/server/db/better-auth-schema";
import { eq } from "drizzle-orm";

/**
 * Check and promote user to super_admin if their email is in SUPER_ADMIN_EMAILS
 * This runs asynchronously and doesn't block the request
 */
async function checkAndPromoteSuperAdmin(userId: string, userEmail: string | null) {
  if (!userEmail) return;
  
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  const isSuperAdmin = superAdminEmails.includes(userEmail.toLowerCase());

  if (isSuperAdmin) {
    try {
      const existingUser = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (existingUser.length > 0 && existingUser[0]!.role !== "super_admin") {
        await db
          .update(user)
          .set({
            role: "super_admin",
            updatedAt: new Date(),
          })
          .where(eq(user.id, userId));
        
        console.log(`✅ [Better Auth] Promoted ${userEmail} to super_admin`);
      }
    } catch (error) {
      console.error("⚠️  [Better Auth] Failed to promote user to super_admin:", error);
    }
  }
}

/**
 * Get the current session using Better Auth
 * This is cached per request
 */
export const getSession = cache(async () => {
  const headers = await getHeaders();
  const session = await auth.api.getSession({
    headers: headers,
  });
  
  // Check and promote to super_admin if needed (fire and forget)
  if (session?.user?.id && session?.user?.email) {
    checkAndPromoteSuperAdmin(session.user.id, session.user.email).catch(console.error);
  }
  
  return session;
});

/**
 * Get session from API route request
 * Use this in API routes (app/api/.../route.ts)
 */
export async function getSessionFromRequest(request: NextRequest) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });
  
  const session = await auth.api.getSession({
    headers: headers,
  });
  
  // Check and promote to super_admin if needed (fire and forget)
  if (session?.user?.id && session?.user?.email) {
    checkAndPromoteSuperAdmin(session.user.id, session.user.email).catch(console.error);
  }
  
  return session;
}

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
 * Check if user is an admin (fetches role from database)
 * Use this in API routes where Better Auth session type doesn't include role
 */
export async function isAdminFromRequest(request: NextRequest): Promise<boolean> {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return false;
  }

  const { db } = await import("@/server/db");
  const { users } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user.length === 0) {
    return false;
  }

  return user[0]!.role === "admin" || user[0]!.role === "super_admin";
}

/**
 * Check if user is an admin (fetches role from database)
 */
export async function isAdmin() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return false;
  }

  const { db } = await import("@/server/db");
  const { users } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");

  const userData = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (userData.length === 0) {
    return false;
  }

  return userData[0]!.role === "admin" || userData[0]!.role === "super_admin";
}

/**
 * Require admin access - redirects if not admin
 */
export async function requireAdmin() {
  const session = await requireAuth();
  const isAdminUser = await isAdmin();
  
  if (!isAdminUser) {
    redirect("/dashboard");
  }
  return session;
}

// Re-export the auth instance for direct use
export { auth } from "@/lib/auth";
export { authClient } from "@/lib/auth-client";
