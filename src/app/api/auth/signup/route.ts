import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, sqlite } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "@/server/services/email";
import { createExampleBooksForUser } from "@/server/utils/create-example-books";
import { initializeMigrations } from "@/server/db/migrations";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

export async function POST(request: Request) {
	// Rate limiting for signup endpoint
	const rateLimitResponse = rateLimitMiddleware(request, "auth:signup", RATE_LIMITS.AUTH);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	try {
		// Log test mode status - always log to help debug
		const isTestMode = process.env.DISABLE_EMAIL_IN_TESTS === "true" || process.env.NODE_ENV === "test";
		console.log("[Signup] Environment check:", {
			DISABLE_EMAIL_IN_TESTS: process.env.DISABLE_EMAIL_IN_TESTS,
			NODE_ENV: process.env.NODE_ENV,
			isTestMode,
		});
		
		// Ensure database tables exist before signup
		try {
			initializeMigrations();
		} catch (migrationError: any) {
			console.error("[Signup] Error initializing migrations:", migrationError);
			// Don't throw - try to continue, tables might already exist
		}
		
		// Check if sqlite is available
		if (!sqlite) {
			const errorMsg = "Database connection not available";
			console.error("[Signup] SQLite database connection is not available!");
			if (isTestMode) {
				return NextResponse.json(
					{ 
						error: "Unable to create account. Please try again.",
						details: errorMsg,
					},
					{ status: 500 }
				);
			}
			throw new Error(errorMsg);
		}
		
		// Ensure users and verificationTokens tables exist
		// This is critical for signup to work
		if (sqlite) {
			try {
				// Check if users table exists
				const userTableCheck = sqlite.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_user'"
				).get();
				
				if (!userTableCheck) {
					console.log("[Signup] Creating users table...");
					sqlite.exec(`
						CREATE TABLE IF NOT EXISTS getlostportal_user (
							id TEXT PRIMARY KEY,
							name TEXT,
							email TEXT NOT NULL UNIQUE,
							emailVerified INTEGER,
							image TEXT,
							role TEXT DEFAULT 'user' NOT NULL,
							password TEXT,
							createdAt INTEGER DEFAULT (unixepoch()),
							updatedAt INTEGER DEFAULT (unixepoch())
						)
					`);
					console.log("[Signup] ✅ Users table created");
				} else {
					// Table exists - check if password column exists
					try {
						const columns = sqlite.prepare("PRAGMA table_info(getlostportal_user)").all() as Array<{ name: string }>;
						const hasPassword = columns.some(col => col.name === "password");
						if (!hasPassword) {
							console.log("[Signup] Adding password column to existing users table...");
							sqlite.exec(`ALTER TABLE getlostportal_user ADD COLUMN password TEXT`);
							console.log("[Signup] ✅ Password column added");
						}
					} catch (alterError: any) {
						console.error("[Signup] Error checking/adding password column:", alterError);
						// Continue anyway - column might already exist
					}
				}
				
				// Check if verificationTokens table exists
				const tokenTableCheck = sqlite.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_verification_token'"
				).get();
				
				if (!tokenTableCheck) {
					console.log("[Signup] Creating verification_tokens table...");
					sqlite.exec(`
						CREATE TABLE IF NOT EXISTS getlostportal_verification_token (
							identifier TEXT NOT NULL,
							token TEXT NOT NULL,
							expires INTEGER NOT NULL,
							PRIMARY KEY (identifier, token)
						)
					`);
					console.log("[Signup] ✅ Verification tokens table created");
				}
			} catch (tableError: any) {
				console.error("[Signup] Error ensuring tables exist:", tableError);
				// Continue anyway - tables might already exist
			}
		}
		
		const body = await request.json();
		const { name, email, password } = body;

		// Validate input
		if (!name || !email || !password) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return NextResponse.json(
				{ error: "Invalid email format" },
				{ status: 400 }
			);
		}

		// Check password length
		if (password.length < 8) {
			return NextResponse.json(
				{ error: "Password must be at least 8 characters" },
				{ status: 400 }
			);
		}

		// Check if user already exists
		let existingUser;
		try {
			existingUser = await db
				.select()
				.from(users)
				.where(eq(users.email, email.toLowerCase()))
				.limit(1);
		} catch (dbError: any) {
			console.error("[Signup] Error checking for existing user:", dbError);
			throw new Error(`Database error checking user: ${dbError?.message || String(dbError)}`);
		}

		if (existingUser.length > 0) {
			return NextResponse.json(
				{ error: "An account with this email already exists" },
				{ status: 409 }
			);
		}

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create the user (with emailVerified as null to require verification)
		let newUser;
		try {
			newUser = await db
				.insert(users)
				.values({
					name: name.trim(),
					email: email.toLowerCase().trim(),
					password: hashedPassword,
					role: "user",
					emailVerified: null, // User needs to verify email
				})
				.returning({
					id: users.id,
					email: users.email,
					name: users.name,
					role: users.role,
				});
		} catch (insertError: any) {
			console.error("[Signup] Error inserting user:", insertError);
			console.error("[Signup] Insert error details:", {
				message: insertError?.message,
				code: insertError?.code,
				cause: insertError?.cause,
			});
			throw new Error(`Failed to create user: ${insertError?.message || String(insertError)}`);
		}

		// Generate verification token
		const verificationToken = crypto.randomBytes(32).toString("hex");
		const expires = new Date();
		expires.setHours(expires.getHours() + 24); // Token expires in 24 hours

		// Store verification token
		await db.insert(verificationTokens).values({
			identifier: email.toLowerCase().trim(),
			token: verificationToken,
			expires: expires,
		});

		// Send verification email
		const emailSent = await sendVerificationEmail(
			email.toLowerCase().trim(),
			verificationToken
		);

		if (!emailSent) {
			console.error("Failed to send verification email to:", email);
		}

		const createdUser = newUser[0]!;

		// Create example books for the user
		// In test mode, wait for completion to ensure books are ready
		// Reuse isTestMode from earlier in the function
		if (isTestMode) {
			// In test mode, wait for books to be created
			try {
				await createExampleBooksForUser(createdUser.id);
				console.log("✅ [Signup] Example books created for test user");
			} catch (error) {
				console.error("❌ [Signup] Failed to create example books:", error);
				// Don't fail signup if example books fail, but log the error
			}
		} else {
			// In production, create async (don't wait)
			createExampleBooksForUser(createdUser.id).catch((error) => {
				console.error("❌ [Signup] Failed to create example books:", error);
				// Don't fail signup if example books fail
			});
		}

		// Return success (user is created but not logged in)
		return NextResponse.json(
			{
				message: "Account created successfully. Please check your email to verify your account.",
				user: {
					id: createdUser.id,
					email: createdUser.email,
					name: createdUser.name,
				},
				emailSent,
			},
			{ status: 201 }
		);
	} catch (error: any) {
		console.error("Signup error:", error);
		console.error("Signup error details:", {
			message: error?.message,
			stack: error?.stack,
			name: error?.name,
			code: error?.code,
			cause: error?.cause,
		});
		
		// Always return detailed error in test mode for debugging
		// Check again in catch block in case env vars weren't available earlier
		const isTestMode = process.env.DISABLE_EMAIL_IN_TESTS === "true" || process.env.NODE_ENV === "test";
		
		console.error("[Signup] Error caught, isTestMode:", isTestMode);
		
		const errorResponse: any = {
			error: "Unable to create account. Please try again.",
		};
		
		// Always include details in test mode, or if we can't determine test mode, include them anyway for debugging
		if (isTestMode || !process.env.DISABLE_EMAIL_IN_TESTS) {
			errorResponse.details = error?.message || String(error);
			errorResponse.stack = error?.stack;
			errorResponse.name = error?.name;
			errorResponse.code = error?.code;
			if (error?.cause) {
				errorResponse.cause = error?.cause?.message || error?.cause;
			}
			errorResponse.envCheck = {
				DISABLE_EMAIL_IN_TESTS: process.env.DISABLE_EMAIL_IN_TESTS,
				NODE_ENV: process.env.NODE_ENV,
			};
			console.error("[Signup] Returning detailed error:", errorResponse);
		}
		
		return NextResponse.json(errorResponse, { status: 500 });
	}
}