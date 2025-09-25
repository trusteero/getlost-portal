import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { sendPasswordResetEmail } from "@/server/services/email";

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

    // Find user by email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user.length > 0) {
      // Delete any existing password reset tokens for this email
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, `reset:${email.toLowerCase()}`));

      // Generate password reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date();
      expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

      // Store password reset token with "reset:" prefix to differentiate from email verification
      await db.insert(verificationTokens).values({
        identifier: `reset:${email.toLowerCase()}`,
        token: resetToken,
        expires: expires,
      });

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(
        email.toLowerCase(),
        resetToken
      );

      if (!emailSent) {
        console.error("Failed to send password reset email to:", email);
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Unable to process password reset request. Please try again." },
      { status: 500 }
    );
  }
}