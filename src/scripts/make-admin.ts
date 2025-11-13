#!/usr/bin/env node
/**
 * Script to make a user an admin or super admin
 * Usage: npm run make-admin <email> [role]
 * Examples:
 *   npm run make-admin user@example.com        # Makes user an admin
 *   npm run make-admin user@example.com admin  # Makes user an admin
 *   npm run make-admin user@example.com super  # Makes user a super admin
 */

// Set DATABASE_URL before importing db module
// On Render, always use the persistent disk path
// Locally, use dev.db if DATABASE_URL points to build database
if (process.env.RENDER === "true" || process.cwd().includes("/opt/render")) {
	// On Render, always use persistent disk
	process.env.DATABASE_URL = "file:/var/data/db.sqlite";
} else if (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes("build") || process.env.DATABASE_URL.includes("build-db"))) {
	// Local: use dev.db instead of build database
	process.env.DATABASE_URL = "file:./dev.db";
} else if (!process.env.DATABASE_URL) {
	// Default to dev.db locally
	process.env.DATABASE_URL = "file:./dev.db";
}

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function makeAdmin(email: string, role: "admin" | "super_admin" = "admin") {
	try {
		console.log(`Looking for user with email: ${email}`);
		console.log(`Using database: ${process.env.DATABASE_URL}`);

		// Find the user
		const user = await db.select().from(users).where(eq(users.email, email)).limit(1);

		if (user.length === 0) {
			console.error(`No user found with email: ${email}`);
			process.exit(1);
		}

		const currentRole = user[0]!.role;
		if (currentRole === role) {
			console.log(`ℹ️  User ${email} already has role: ${role}`);
			process.exit(0);
		}

		// Update the user's role
		await db
			.update(users)
			.set({ 
				role,
				updatedAt: new Date(),
			})
			.where(eq(users.email, email));

		const roleLabel = role === "super_admin" ? "super admin" : "admin";
		console.log(`✅ Successfully made ${email} a ${roleLabel}`);
		console.log(`   Previous role: ${currentRole || "user"}`);
		console.log(`   New role: ${role}`);
		process.exit(0);
	} catch (error) {
		console.error("Error updating user role:", error);
		process.exit(1);
	}
}

// Get email and optional role from command line arguments
const email = process.argv[2];
const roleArg = process.argv[3]?.toLowerCase();

if (!email) {
	console.error("Please provide an email address");
	console.error("Usage: npm run make-admin <email> [role]");
	console.error("Examples:");
	console.error("  npm run make-admin user@example.com        # Makes user an admin");
	console.error("  npm run make-admin user@example.com admin # Makes user an admin");
	console.error("  npm run make-admin user@example.com super # Makes user a super admin");
	process.exit(1);
}

// Parse role argument
let role: "admin" | "super_admin" = "admin";
if (roleArg === "super" || roleArg === "super_admin" || roleArg === "superadmin") {
	role = "super_admin";
} else if (roleArg && roleArg !== "admin") {
	console.error(`Invalid role: ${roleArg}`);
	console.error("Valid roles: admin, super (or super_admin)");
	process.exit(1);
}

makeAdmin(email, role);