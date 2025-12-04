#!/usr/bin/env tsx
/**
 * Script to manually create example books for a user
 * Usage:
 *   npx tsx scripts/create-example-books-for-user.ts <user-email>
 *   OR
 *   npx tsx scripts/create-example-books-for-user.ts --userId <user-id>
 */

import { db } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { createExampleBooksForUser } from "../src/server/utils/create-example-books";

async function main() {
  const args = process.argv.slice(2);
  
  let userEmail: string | undefined;
  let userId: string | undefined;

  // Parse arguments
  if (args[0] === "--userId" && args[1]) {
    userId = args[1];
  } else if (args[0] && !args[0].startsWith("--")) {
    userEmail = args[0];
  } else {
    console.error("Usage:");
    console.error("  npx tsx scripts/create-example-books-for-user.ts <user-email>");
    console.error("  OR");
    console.error("  npx tsx scripts/create-example-books-for-user.ts --userId <user-id>");
    process.exit(1);
  }

  try {
    let targetUserId: string;

    if (userId) {
      // Find user by ID
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        console.error(`❌ User with ID ${userId} not found`);
        process.exit(1);
      }

      targetUserId = user[0]!.id;
      console.log(`📚 Creating example books for user: ${user[0]!.email} (${targetUserId})`);
    } else if (userEmail) {
      // Find user by email
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, userEmail.toLowerCase()))
        .limit(1);

      if (user.length === 0) {
        console.error(`❌ User with email ${userEmail} not found`);
        process.exit(1);
      }

      targetUserId = user[0]!.id;
      console.log(`📚 Creating example books for user: ${userEmail} (${targetUserId})`);
    } else {
      console.error("❌ Please provide either user email or user ID");
      process.exit(1);
    }

    // Create example books
    console.log("🔄 Creating example books...");
    await createExampleBooksForUser(targetUserId);
    console.log("✅ Example books created successfully!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating example books:", error);
    process.exit(1);
  }
}

main();

