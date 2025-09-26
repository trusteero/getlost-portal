import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users, userActivity } from "@/server/db/schema";
import { sql, gte, and, eq } from "drizzle-orm";
import { getAnalytics } from "@/server/services/analytics";

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
    // Get date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get new users today
    const todayTimestamp = Math.floor(today.getTime() / 1000);
    const tomorrowTimestamp = Math.floor(tomorrow.getTime() / 1000);
    const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);

    // Get all users and filter in memory (simpler for SQLite)
    const allUsers = await db.select().from(users);

    const newUsersToday = allUsers.filter(u => {
      const createdAt = u.createdAt || 0;
      return createdAt >= todayTimestamp && createdAt < tomorrowTimestamp;
    }).length;

    const newUsersYesterday = allUsers.filter(u => {
      const createdAt = u.createdAt || 0;
      return createdAt >= yesterdayTimestamp && createdAt < todayTimestamp;
    }).length;

    // Get DAU from activity tracking
    const analytics = await getAnalytics();

    // Total users is already calculated from allUsers
    const totalUsersCount = allUsers.length;

    return NextResponse.json({
      newUsersToday,
      newUsersYesterday,
      dailyActiveUsers: analytics.dailyActiveUsers,
      totalUsers: totalUsersCount,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}