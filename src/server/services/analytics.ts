import { db } from "@/server/db";
import { userActivity } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Track user activity for DAU (Daily Active Users) calculation
 * Creates or updates a single row per user per day
 */
export async function trackUserActivity(userId: string) {
  try {
    // Get current date in YYYY-MM-DD format (local time)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Try to find existing activity record for today
    const existingActivity = await db
      .select()
      .from(userActivity)
      .where(
        and(
          eq(userActivity.userId, userId),
          eq(userActivity.date, dateStr)
        )
      )
      .limit(1);

    if (existingActivity.length > 0) {
      // Update existing record
      await db
        .update(userActivity)
        .set({
          lastActivityAt: new Date(),
          activityCount: sql`${userActivity.activityCount} + 1`,
        })
        .where(eq(userActivity.id, existingActivity[0]!.id));
    } else {
      // Create new record for today
      await db
        .insert(userActivity)
        .values({
          userId,
          date: dateStr,
          firstActivityAt: new Date(),
          lastActivityAt: new Date(),
          activityCount: 1,
        });
    }
  } catch (error) {
    // Log error but don't throw - analytics shouldn't break the app
    console.error("Failed to track user activity:", error);
  }
}

/**
 * Get analytics data for admin dashboard
 */
export async function getAnalytics() {
  // Use local date string to avoid timezone issues
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Calculate yesterday's date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayYear = yesterday.getFullYear();
  const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;

  // Get DAU for today
  const dauToday = await db
    .select({ count: sql<number>`count(distinct ${userActivity.userId})` })
    .from(userActivity)
    .where(eq(userActivity.date, todayStr));

  // Get DAU for yesterday (for comparison)
  const dauYesterday = await db
    .select({ count: sql<number>`count(distinct ${userActivity.userId})` })
    .from(userActivity)
    .where(eq(userActivity.date, yesterdayStr));

  return {
    dailyActiveUsers: dauToday[0]?.count || 0,
    dailyActiveUsersYesterday: dauYesterday[0]?.count || 0,
  };
}