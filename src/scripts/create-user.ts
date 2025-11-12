#!/usr/bin/env node
/**
 * Script to create a user account
 * Usage: npm run create-user <email> <password> <name>
 * Example: npm run create-user eero.jyske@gmail.com mypassword "Eero Jyske"
 */

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

async function createUser(email: string, password: string, name: string) {
	try {
		console.log(`Creating user account for: ${email}`);

		// Check if user already exists
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (existingUser.length > 0) {
			console.log(`⚠️  User with email ${email} already exists`);
			console.log(`   User ID: ${existingUser[0]!.id}`);
			console.log(`   Role: ${existingUser[0]!.role}`);
			console.log(`   Email Verified: ${existingUser[0]!.emailVerified ? "Yes" : "No"}`);
			
			// Ask if we should update password
			console.log(`\n💡 To update password, use: npm run reset-password ${email} <new-password>`);
			process.exit(0);
		}

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create the user with email verified (for production use)
		const userId = randomUUID();
		await db.insert(users).values({
			id: userId,
			name: name.trim(),
			email: email.toLowerCase().trim(),
			password: hashedPassword,
			role: "user",
			emailVerified: new Date(), // Mark as verified for production
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		console.log(`✅ Successfully created user account:`);
		console.log(`   Email: ${email}`);
		console.log(`   Name: ${name}`);
		console.log(`   User ID: ${userId}`);
		console.log(`   Email Verified: Yes`);
		console.log(`   Role: user`);
		
		// Check if should be admin
		const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
		if (superAdminEmails.includes(email.toLowerCase())) {
			await db.update(users).set({ role: "admin" }).where(eq(users.email, email.toLowerCase()));
			console.log(`   ⬆️  Promoted to admin (found in SUPER_ADMIN_EMAILS)`);
		}
		
		process.exit(0);
	} catch (error) {
		console.error("Error creating user:", error);
		process.exit(1);
	}
}

// Get arguments from command line
const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || email.split("@")[0]; // Use email prefix as name if not provided

if (!email || !password) {
	console.error("Please provide email and password");
	console.error("Usage: npm run create-user <email> <password> [name]");
	console.error("Example: npm run create-user eero.jyske@gmail.com mypassword123 \"Eero Jyske\"");
	process.exit(1);
}

createUser(email, password, name);

