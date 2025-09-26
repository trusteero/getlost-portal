import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { db } from "../src/server/db";
import { userActivity, users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function checkAnalytics() {
  console.log("Checking analytics data...\n");

  // Get today's date string
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]!;
  console.log("Today's date:", todayStr);

  // Check all user activity records
  const allActivity = await db.select().from(userActivity);
  console.log("\nTotal user activity records:", allActivity.length);

  if (allActivity.length > 0) {
    console.log("\nActivity records:");
    allActivity.forEach(activity => {
      console.log(`- User: ${activity.userId}, Date: ${activity.date}, Count: ${activity.activityCount}`);
    });
  }

  // Check today's activity specifically
  const todayActivity = await db
    .select()
    .from(userActivity)
    .where(eq(userActivity.date, todayStr));

  console.log("\nToday's activity records:", todayActivity.length);

  // Get all users
  const allUsers = await db.select().from(users);
  console.log("\nTotal users:", allUsers.length);

  // If no activity today, let's manually track for existing users
  if (todayActivity.length === 0 && allUsers.length > 0) {
    console.log("\nNo activity tracked today. Adding test activity for first user...");

    const firstUser = allUsers[0];
    if (firstUser) {
      await db.insert(userActivity).values({
        userId: firstUser.id,
        date: todayStr,
        activityCount: 1
      });
      console.log(`Added activity for user ${firstUser.email} on ${todayStr}`);
    }
  }

  // Re-check today's activity
  const updatedTodayActivity = await db
    .select()
    .from(userActivity)
    .where(eq(userActivity.date, todayStr));

  console.log("\nUpdated today's activity count:", updatedTodayActivity.length);
}

checkAnalytics()
  .then(() => {
    console.log("\n✓ Analytics check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error checking analytics:", error);
    process.exit(1);
  });