import { NextResponse } from "next/server";
import { db, sqlite } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { user as betterAuthUser, verification as betterAuthVerification } from "@/server/db/better-auth-schema";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "@/server/services/email";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import crypto from "crypto";

const handler = toNextJsHandler(auth);

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

    // Better Auth uses JWT tokens - try to verify it first
    // JWT tokens start with "eyJ" (base64 encoded JSON)
    const isJWT = token.startsWith("eyJ");
    
    if (isJWT) {
      // This is a Better Auth JWT token
      // First, let Better Auth handle the verification
      try {
        console.log("🔐 [Verify Email] Processing Better Auth JWT token");
        
        // Call Better Auth's handler to verify the token
        const authResponse = await handler.GET(request);
        
        // Check if Better Auth successfully verified the email
        if (authResponse.status === 200 || authResponse.status === 302) {
          console.log("✅ [Verify Email] Better Auth verified the email successfully");
          
          // Decode JWT to get the email for sending welcome email
          const parts = token.split(".");
          let email: string | undefined;
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1]!, "base64").toString());
            email = payload.email;
            
            if (email) {
              // Find the verified user and send welcome email
              const verifiedUser = await db
                .select()
                .from(betterAuthUser)
                .where(eq(betterAuthUser.email, email.toLowerCase()))
                .limit(1);
              
              if (verifiedUser.length > 0 && verifiedUser[0]!.emailVerified) {
                try {
                  await sendWelcomeEmail(verifiedUser[0]!.email, verifiedUser[0]!.name || undefined);
                  console.log("✅ [Verify Email] Welcome email sent");
                } catch (emailError) {
                  console.error("❌ [Verify Email] Failed to send welcome email:", emailError);
                  // Don't fail the verification if email fails
                }
              }
            }
          }
          
          // Instead of returning Better Auth's redirect, return JSON so the verification page can show confirmation
          // The verification page will handle redirecting to login
          return NextResponse.json({
            message: "Email verified successfully! You can now sign in.",
            user: email ? { email } : undefined,
            requiresSignIn: true,
          });
        } else {
          // Better Auth failed to verify, try our manual update as fallback
          console.warn("⚠️ [Verify Email] Better Auth verification failed, trying manual update");
          
          // Decode JWT to get the email and verify it's valid
          const parts = token.split(".");
          if (parts.length !== 3) {
            throw new Error("Invalid JWT format");
          }

          const payload = JSON.parse(Buffer.from(parts[1]!, "base64").toString());
          const email = payload.email;

          if (!email) {
            return NextResponse.json(
              { error: "Invalid verification token" },
              { status: 400 }
            );
          }

          // Check if token is expired
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            return NextResponse.json(
              { error: "Verification token has expired. Please request a new one." },
              { status: 400 }
            );
          }

          console.log("📧 [Verify Email] Verifying email for:", email);

          // First, check if user exists
          const existingUser = await db
            .select()
            .from(betterAuthUser)
            .where(eq(betterAuthUser.email, email.toLowerCase()))
            .limit(1);

          if (existingUser.length === 0) {
            console.error("❌ [Verify Email] User not found for email:", email);
            return NextResponse.json(
              { error: "User not found" },
              { status: 404 }
            );
          }

          // Use raw SQL to ensure emailVerified is set to 1 (boolean true)
          // This works around any Drizzle type conversion issues
          console.log("🔧 [Verify Email] Executing raw SQL update");
          if (!sqlite) {
            throw new Error("Database connection not available");
          }
          const updatedAt = Math.floor(Date.now() / 1000);
          const stmt = sqlite.prepare(
            `UPDATE getlostportal_user SET emailVerified = 1, updatedAt = ? WHERE email = ?`
          );
          const result = stmt.run(updatedAt, email.toLowerCase());
          console.log("✅ [Verify Email] SQL update executed, rows changed:", result.changes);
          
          // Verify the update worked
          const verifyStmt = sqlite.prepare(
            `SELECT emailVerified FROM getlostportal_user WHERE email = ?`
          );
          const verifyResult = verifyStmt.get(email.toLowerCase()) as { emailVerified: number } | undefined;
          console.log("✅ [Verify Email] Verified emailVerified value in DB:", verifyResult?.emailVerified);

          // Fetch the updated user
          const updatedUser = await db
            .select({
              id: betterAuthUser.id,
              email: betterAuthUser.email,
              name: betterAuthUser.name,
              emailVerified: betterAuthUser.emailVerified,
            })
            .from(betterAuthUser)
            .where(eq(betterAuthUser.email, email.toLowerCase()))
            .limit(1);

          const verifiedUser = updatedUser[0]!;
          console.log("✅ [Verify Email] Updated emailVerified to true for user:", verifiedUser.id);
          console.log("✅ [Verify Email] emailVerified value:", verifiedUser.emailVerified);

          // Also update the main users table for consistency
          await db
            .update(users)
            .set({
              emailVerified: new Date(),
            })
            .where(eq(users.email, email.toLowerCase()));

          // Delete the verification record from Better Auth's verification table
          await db
            .delete(betterAuthVerification)
            .where(eq(betterAuthVerification.identifier, email.toLowerCase()));

          // Send welcome email
          try {
            await sendWelcomeEmail(verifiedUser.email, verifiedUser.name || undefined);
            console.log("✅ [Verify Email] Welcome email sent");
          } catch (emailError) {
            console.error("❌ [Verify Email] Failed to send welcome email:", emailError);
            // Don't fail the verification if email fails
          }

          return NextResponse.json({
            message: "Email verified successfully",
            user: {
              id: verifiedUser.id,
              email: verifiedUser.email,
              name: verifiedUser.name,
            },
            requiresSignIn: true,
          });
        }
      } catch (jwtError: any) {
        console.error("❌ [Verify Email] JWT verification error:", jwtError);
        // Fall through to old token verification
      }
    }

    // Fallback: Try old verification token format
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