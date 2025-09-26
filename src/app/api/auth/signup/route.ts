import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "@/server/services/email";

export async function POST(request: Request) {
	try {
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
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (existingUser.length > 0) {
			return NextResponse.json(
				{ error: "An account with this email already exists" },
				{ status: 409 }
			);
		}

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create the user (with emailVerified as null to require verification)
		const newUser = await db
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
	} catch (error) {
		console.error("Signup error:", error);
		return NextResponse.json(
			{ error: "Unable to create account. Please try again." },
			{ status: 500 }
		);
	}
}