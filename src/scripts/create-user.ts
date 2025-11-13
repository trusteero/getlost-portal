#!/usr/bin/env node
/**
 * Script to create a user account
 * Usage: npm run create-user <email> <password> <name>
 * Example: npm run create-user eero.jyske@gmail.com mypassword "Eero Jyske"
 */

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { account, user } from "@/server/db/better-auth-schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { env } from "@/env";

async function ensureBetterAuthTables() {
	// Parse database path
	let dbPath = env.DATABASE_URL || "./dev.db";
	if (dbPath.startsWith('file://')) {
		dbPath = dbPath.replace(/^file:\/\//, '');
	} else if (dbPath.startsWith('file:')) {
		dbPath = dbPath.replace(/^file:/, '');
	}

	const sqlite = new Database(dbPath);
	
	try {
		// Check if Better Auth tables exist (with getlostportal_ prefix)
		const tables = sqlite.prepare(`
			SELECT name FROM sqlite_master 
			WHERE type='table' AND name IN ('getlostportal_user', 'getlostportal_account', 'getlostportal_session', 'getlostportal_verification')
		`).all() as Array<{ name: string }>;
		
		const existingTableNames = tables.map(t => t.name);
		
		// Create user table if it doesn't exist
		if (!existingTableNames.includes('getlostportal_user')) {
			console.log("📦 Creating Better Auth 'user' table...");
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS getlostportal_user (
					id TEXT PRIMARY KEY,
					name TEXT,
					email TEXT NOT NULL UNIQUE,
					emailVerified INTEGER DEFAULT 0,
					image TEXT,
					role TEXT DEFAULT 'user' NOT NULL,
					createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
					updatedAt INTEGER DEFAULT (unixepoch()) NOT NULL
				)
			`);
		}
		
		// Create account table if it doesn't exist
		if (!existingTableNames.includes('getlostportal_account')) {
			console.log("📦 Creating Better Auth 'account' table...");
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS getlostportal_account (
					id TEXT PRIMARY KEY,
					account_id TEXT NOT NULL,
					provider_id TEXT NOT NULL,
					user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE,
					access_token TEXT,
					refresh_token TEXT,
					id_token TEXT,
					access_token_expires_at INTEGER,
					refresh_token_expires_at INTEGER,
					scope TEXT,
					password TEXT,
					created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
					updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
				)
			`);
		}
		
		// Create session table if it doesn't exist
		if (!existingTableNames.includes('getlostportal_session')) {
			console.log("📦 Creating Better Auth 'session' table...");
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS getlostportal_session (
					id TEXT PRIMARY KEY,
					expires_at INTEGER NOT NULL,
					token TEXT NOT NULL UNIQUE,
					created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
					updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
					ip_address TEXT,
					user_agent TEXT,
					user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE
				)
			`);
		}
		
		// Create verification table if it doesn't exist
		if (!existingTableNames.includes('getlostportal_verification')) {
			console.log("📦 Creating Better Auth 'verification' table...");
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS getlostportal_verification (
					id TEXT PRIMARY KEY,
					identifier TEXT NOT NULL,
					value TEXT NOT NULL,
					expires_at INTEGER NOT NULL,
					created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
					updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
				)
			`);
		}
		
		console.log("✅ Better Auth tables ready");
	} finally {
		sqlite.close();
	}
}

async function createUser(email: string, password: string, name: string) {
	try {
		console.log(`Creating user account for: ${email}`);
		
		// Ensure Better Auth tables exist
		await ensureBetterAuthTables();

		// Check if user already exists (Better Auth uses 'user' table)
		const existingUser = await db
			.select()
			.from(user)
			.where(eq(user.email, email.toLowerCase()))
			.limit(1);

		if (existingUser.length > 0) {
			console.log(`⚠️  User with email ${email} already exists`);
			console.log(`   User ID: ${existingUser[0]!.id}`);
			console.log(`   Role: ${existingUser[0]!.role}`);
			console.log(`   Email Verified: ${existingUser[0]!.emailVerified ? "Yes" : "No"}`);
			
			// Check if account exists
			const existingAccount = await db
				.select()
				.from(account)
				.where(eq(account.userId, existingUser[0]!.id))
				.limit(1);
			
			if (existingAccount.length > 0) {
				console.log(`   Account exists with provider: ${existingAccount[0]!.providerId}`);
			} else {
				console.log(`   ⚠️  No account record found - user may not be able to log in`);
			}
			
			console.log(`\n💡 To update password, you'll need to update the account table manually`);
			process.exit(0);
		}

		// Hash the password (Better Auth uses bcrypt)
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create the user in Better Auth format
		const userId = randomUUID();
		const now = new Date();
		
		await db.insert(user).values({
			id: userId,
			name: name.trim(),
			email: email.toLowerCase().trim(),
			emailVerified: true, // Mark as verified
			role: "user",
			createdAt: now,
			updatedAt: now,
		});

		// Create the account record with password (Better Auth stores passwords here)
		const accountId = randomUUID();
		await db.insert(account).values({
			id: accountId,
			accountId: email.toLowerCase().trim(), // Usually the email for credential provider
			providerId: "credential", // Better Auth uses "credential" for email/password
			userId: userId,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now,
		});

		console.log(`✅ Successfully created user account:`);
		console.log(`   Email: ${email}`);
		console.log(`   Name: ${name}`);
		console.log(`   User ID: ${userId}`);
		console.log(`   Account ID: ${accountId}`);
		console.log(`   Email Verified: Yes`);
		console.log(`   Role: user`);
		
		// Check if should be admin
		const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
		if (superAdminEmails.includes(email.toLowerCase())) {
			await db.update(user).set({ role: "admin" }).where(eq(user.email, email.toLowerCase()));
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
const name = process.argv[4] || (email ? email.split("@")[0] : "User"); // Use email prefix as name if not provided

if (!email || !password) {
	console.error("Please provide email and password");
	console.error("Usage: npm run create-user <email> <password> [name]");
	console.error("Example: npm run create-user eero.jyske@gmail.com mypassword123 \"Eero Jyske\"");
	process.exit(1);
}

// TypeScript guard - we know email and password are defined after the check
createUser(email as string, password as string, name as string);

