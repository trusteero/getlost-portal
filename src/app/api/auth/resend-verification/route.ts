import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { user as betterAuthUser, verification as betterAuthVerification } from "@/server/db/better-auth-schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    console.log("📧 [Resend Verification] Request for email:", email);

    // Find user in Better Auth's user table
    const betterAuthUserData = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.email, email.toLowerCase()))
      .limit(1);

    if (betterAuthUserData.length === 0) {
      // Don't reveal whether the email exists
      console.log("📧 [Resend Verification] User not found (or using old table)");
      return NextResponse.json({
        message: "If an account exists with this email, a verification link has been sent."
      });
    }

    const userData = betterAuthUserData[0]!;

    // Check if email is already verified
    if (userData.emailVerified) {
      console.log("📧 [Resend Verification] Email already verified");
      return NextResponse.json({
        message: "Email is already verified. You can sign in."
      });
    }

    console.log("📧 [Resend Verification] User found, generating JWT token");

    // Generate JWT token for Better Auth verification
    const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      console.error("❌ [Resend Verification] AUTH_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create JWT payload
    const payload = {
      email: userData.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    };

    // Encode JWT (simple base64 encoding - Better Auth will verify the signature)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    
    // Create signature
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payloadEncoded}`)
      .digest("base64url");
    
    const token = `${header}.${payloadEncoded}.${signature}`;

    // Store verification token in Better Auth's verification table
    const verificationId = crypto.randomUUID();
    // expiresAt needs to be a Date object for Drizzle's timestamp mode
    const expiresAt = new Date(Date.now() + (60 * 60 * 24 * 1000)); // 24 hours from now

    // Delete any existing verification records for this email
    await db
      .delete(betterAuthVerification)
      .where(eq(betterAuthVerification.identifier, userData.email.toLowerCase()));

    // Insert new verification record
    await db.insert(betterAuthVerification).values({
      id: verificationId,
      identifier: userData.email.toLowerCase(),
      value: token,
      expiresAt: expiresAt, // Date object for timestamp mode
    });

    console.log("📧 [Resend Verification] Verification token stored");

    // Generate verification URL
    const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationURL = `${baseURL}/api/auth/verify-email?token=${token}&callbackURL=/`;

    console.log("📧 [Resend Verification] Sending email with URL:", verificationURL);

    // Use Better Auth's email sending function
    try {
      // Get the sendVerificationEmail function from auth config
      const emailConfig = (auth as any).config?.emailVerification;
      if (emailConfig?.sendVerificationEmail) {
        await emailConfig.sendVerificationEmail({
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name || undefined,
          },
          url: verificationURL,
        });
        console.log("✅ [Resend Verification] Email sent via Better Auth");
      } else {
        // Fallback: use the email service directly
        const { sendEmail } = await import("@/server/services/email");
        const customHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Verify Your Email</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Verify Your Email</h1>
                <p>Click the button below to verify your email address:</p>
                <a href="${verificationURL}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
                  Verify Email
                </a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${verificationURL}</p>
                <p>This link will expire in 24 hours.</p>
              </div>
            </body>
          </html>
        `;
        
        await sendEmail({
          to: userData.email,
          subject: "Verify Your Email Address",
          html: customHtml,
        });
        console.log("✅ [Resend Verification] Email sent via email service");
      }
    } catch (emailError: any) {
      console.error("❌ [Resend Verification] Failed to send verification email:", emailError);
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Verification email sent! Please check your inbox and spam folder."
    });
  } catch (error: any) {
    console.error("❌ [Resend Verification] Error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 }
    );
  }
}