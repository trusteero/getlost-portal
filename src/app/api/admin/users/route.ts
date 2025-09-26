import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users, books, accounts, userActivity } from "@/server/db/schema";
import { sql, desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin or super_admin
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all users
    const allUsers = await db
      .select()
      .from(users);

    // Get book counts for each user
    const userBooks = await db
      .select({
        userId: books.userId,
        count: sql<number>`COUNT(*)`,
      })
      .from(books)
      .groupBy(books.userId);

    // Get Google accounts for users
    const googleAccounts = await db
      .select({
        userId: accounts.userId,
        provider: accounts.provider,
      })
      .from(accounts)
      .where(eq(accounts.provider, "google"));

    // Get last activity for each user with proper datetime
    const lastActivities = await db
      .select({
        userId: userActivity.userId,
        lastActivityDate: sql<string>`MAX(${userActivity.date})`,
        lastActivityTime: sql<string>`MAX(datetime(${userActivity.lastActivityAt}))`,
      })
      .from(userActivity)
      .groupBy(userActivity.userId);

    // Create maps for quick lookup
    const bookCountMap = userBooks.reduce((acc, ub) => {
      acc[ub.userId] = ub.count;
      return acc;
    }, {} as Record<string, number>);

    const googleUsersSet = new Set(googleAccounts.map(ga => ga.userId));

    const lastActivityMap = lastActivities.reduce((acc, la) => {
      acc[la.userId] = la.lastActivityTime || la.lastActivityDate;
      return acc;
    }, {} as Record<string, string>);

    // Combine all data
    const usersWithFullData = allUsers.map(user => ({
      ...user,
      bookCount: bookCountMap[user.id] || 0,
      hasGoogleAuth: googleUsersSet.has(user.id),
      lastActivity: lastActivityMap[user.id] || null,
    }));

    return NextResponse.json(usersWithFullData);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}