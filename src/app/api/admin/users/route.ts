import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { users, books, userActivity } from "@/server/db/schema";
import { account } from "@/server/db/better-auth-schema";
import { sql, desc, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all users (Better Auth uses 'user' table, but we query 'users' from schema which maps to getlostportal_user)
    // Both should work as they reference the same table
    console.log("[Admin Users] Fetching all users...");
    
    // Check if password column exists (for compatibility with both old and new schemas)
    const { columnExists } = await import("@/server/db/migrations");
    const hasPasswordColumn = columnExists("getlostportal_user", "password");
    
    let allUsers;
    if (hasPasswordColumn) {
      // Select all columns including password
      allUsers = await db.select().from(users);
    } else {
      // Select only columns that exist (without password)
      allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          image: users.image,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users);
    }
    
    console.log(`[Admin Users] Found ${allUsers.length} users`);

    // Get book counts for each user
    const userBooks = await db
      .select({
        userId: books.userId,
        count: sql<number>`COUNT(*)`,
      })
      .from(books)
      .groupBy(books.userId);
    
    console.log(`[Admin Users] Found ${userBooks.length} users with books`);

    // Get Google accounts for users (Better Auth uses providerId instead of provider)
    let googleAccounts: Array<{ userId: string }> = [];
    try {
      const googleAccountsResult = await db
        .select({
          userId: account.userId,
        })
        .from(account)
        .where(eq(account.providerId, "google"));
      googleAccounts = googleAccountsResult;
    } catch (error) {
      // If account table doesn't exist or has different structure, continue without Google auth info
      console.warn("Could not fetch Google accounts:", error);
    }

    // Get last activity for each user with proper datetime
    let lastActivities: Array<{ userId: string; lastActivityTime: string | null; lastActivityDate: string | null }> = [];
    try {
      // Check if user_activity table exists first
      const { columnExists } = await import("@/server/db/migrations");
      if (columnExists("getlostportal_user_activity", "userId")) {
        const lastActivitiesResult = await db
          .select({
            userId: userActivity.userId,
            lastActivityDate: sql<string>`MAX(${userActivity.date})`,
            lastActivityTime: sql<string>`MAX(datetime(${userActivity.lastActivityAt}))`,
          })
          .from(userActivity)
          .groupBy(userActivity.userId);
        lastActivities = lastActivitiesResult;
      }
    } catch (error) {
      // If userActivity table doesn't exist, continue without activity info
      // Don't log as error - this is expected if the table hasn't been created yet
    }

    // Create maps for quick lookup
    const bookCountMap = userBooks.reduce((acc: any, ub: any) => {
      acc[ub.userId] = ub.count;
      return acc;
    }, {} as Record<string, number>);

    const googleUsersSet = new Set(googleAccounts.map((ga: any) => ga.userId));

    const lastActivityMap = lastActivities.reduce((acc: any, la: any) => {
      acc[la.userId] = la.lastActivityTime || la.lastActivityDate;
      return acc;
    }, {} as Record<string, string>);

    // Combine all data
    const usersWithFullData = allUsers.map((user: any) => ({
      ...user,
      bookCount: bookCountMap[user.id] || 0,
      hasGoogleAuth: googleUsersSet.has(user.id),
      lastActivity: lastActivityMap[user.id] || null,
    }));

    console.log(`[Admin Users] Returning ${usersWithFullData.length} users with full data`);
    return NextResponse.json(usersWithFullData);
  } catch (error) {
    console.error("[Admin Users] Failed to fetch users:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Admin Users] Error details:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch users", details: errorMessage },
      { status: 500 }
    );
  }
}