import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, verificationTokens, sessions } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { sendWelcomeEmail } from "@/server/services/email";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find the verification token
    const verificationToken = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1);

    if (verificationToken.length === 0) {
      return NextResponse.json(
        { error: "Invalid verification token" },
        { status: 400 }
      );
    }

    const tokenData = verificationToken[0]!;

    // Check if token has expired
    if (new Date(tokenData.expires) < new Date()) {
      // Delete expired token
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token));

      return NextResponse.json(
        { error: "Verification token has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Update user's emailVerified field
    const updatedUser = await db
      .update(users)
      .set({
        emailVerified: new Date(),
      })
      .where(eq(users.email, tokenData.identifier))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });

    if (updatedUser.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Delete the used token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token));

    const verifiedUser = updatedUser[0]!;

    // Send welcome email
    await sendWelcomeEmail(verifiedUser.email, verifiedUser.name || undefined);

    // Don't create a session here - let the user sign in through the normal flow
    // This avoids JWT/session conflicts
    return NextResponse.json({
      message: "Email verified successfully",
      user: verifiedUser,
      requiresSignIn: true,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Unable to verify email. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists and is not verified
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = user[0]!;

    if (userData.emailVerified) {
      return NextResponse.json(
        { message: "Email is already verified" },
        { status: 200 }
      );
    }

    // Delete any existing tokens for this email
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, email.toLowerCase()));

    // Generate new verification token
    const crypto = require("crypto");
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // Token expires in 24 hours

    // Store verification token
    await db.insert(verificationTokens).values({
      identifier: email.toLowerCase(),
      token: verificationToken,
      expires: expires,
    });

    // Send verification email
    const { sendVerificationEmail } = require("@/server/services/email");
    const emailSent = await sendVerificationEmail(
      email.toLowerCase(),
      verificationToken
    );

    return NextResponse.json({
      message: emailSent
        ? "Verification email sent successfully"
        : "Failed to send verification email",
      emailSent,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Unable to resend verification email. Please try again." },
      { status: 500 }
    );
  }
}