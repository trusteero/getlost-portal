import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { sql, gte, and } from "drizzle-orm";

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
    const newUsersToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          gte(users.createdAt, today),
          sql`${users.createdAt} < ${tomorrow}`
        )
      );

    // Get new users yesterday
    const newUsersYesterday = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          gte(users.createdAt, yesterday),
          sql`${users.createdAt} < ${today}`
        )
      );

    // Get daily active users (users who logged in today based on lastLogin)
    const dailyActiveUsers = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(
        and(
          gte(users.lastLogin, today),
          sql`${users.lastLogin} < ${tomorrow}`
        )
      );

    // Get total users
    const totalUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    return NextResponse.json({
      newUsersToday: newUsersToday[0]?.count || 0,
      newUsersYesterday: newUsersYesterday[0]?.count || 0,
      dailyActiveUsers: dailyActiveUsers[0]?.count || 0,
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