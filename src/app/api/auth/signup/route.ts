import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

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

		// Create the user
		const newUser = await db
			.insert(users)
			.values({
				name: name.trim(),
				email: email.toLowerCase().trim(),
				password: hashedPassword,
				role: "user",
			})
			.returning({
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
			});

		// Return success (user is created but not logged in)
		return NextResponse.json(
			{
				message: "Account created successfully",
				user: {
					id: newUser[0].id,
					email: newUser[0].email,
					name: newUser[0].name,
				},
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