#!/usr/bin/env node
/**
 * Script to make a user an admin
 * Usage: npm run make-admin <email>
 */

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function makeAdmin(email: string) {
	try {
		console.log(`Looking for user with email: ${email}`);

		// Find the user
		const user = await db.select().from(users).where(eq(users.email, email)).limit(1);

		if (user.length === 0) {
			console.error(`No user found with email: ${email}`);
			process.exit(1);
		}

		// Update the user's role to admin
		await db.update(users).set({ role: "admin" }).where(eq(users.email, email));

		console.log(`✅ Successfully made ${email} an admin`);
		process.exit(0);
	} catch (error) {
		console.error("Error making user admin:", error);
		process.exit(1);
	}
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
	console.error("Please provide an email address");
	console.error("Usage: npm run make-admin <email>");
	process.exit(1);
}

makeAdmin(email);