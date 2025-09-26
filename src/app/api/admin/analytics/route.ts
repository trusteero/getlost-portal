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

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  const isAdmin = session.user.role === "admin" || adminEmails.includes(session.user.email || "");

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

    const newUsersToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        sql`${users.createdAt} >= ${todayTimestamp} AND ${users.createdAt} < ${tomorrowTimestamp}`
      );

    // Get new users yesterday
    const newUsersYesterday = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        sql`${users.createdAt} >= ${yesterdayTimestamp} AND ${users.createdAt} < ${todayTimestamp}`
      );

    // Get DAU from activity tracking
    const analytics = await getAnalytics();

    // Get total users
    const totalUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    return NextResponse.json({
      newUsersToday: newUsersToday[0]?.count || 0,
      newUsersYesterday: newUsersYesterday[0]?.count || 0,
      dailyActiveUsers: analytics.dailyActiveUsers,
      totalUsers: totalUsers[0]?.count || 0,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}