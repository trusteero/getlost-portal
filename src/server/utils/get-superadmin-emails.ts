import { env } from "@/env";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get all superadmin email addresses
 * Checks both SUPER_ADMIN_EMAILS env var and database users with role="super_admin"
 */
export async function getSuperAdminEmails(): Promise<string[]> {
  const emails: string[] = [];

  // First, get emails from environment variable
  if (env.SUPER_ADMIN_EMAILS) {
    const envEmails = env.SUPER_ADMIN_EMAILS.split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    emails.push(...envEmails);
  }

  // Then, get emails from database users with super_admin role
  try {
    const superAdminUsers = await db
      .select({
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, "super_admin"));

    for (const user of superAdminUsers) {
      if (user.email && !emails.includes(user.email)) {
        emails.push(user.email);
      }
    }
  } catch (error) {
    console.error("[SuperAdmin] Failed to fetch superadmin users from database:", error);
    // Continue with env emails only
  }

  return emails;
}

