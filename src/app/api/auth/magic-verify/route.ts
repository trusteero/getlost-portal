import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, verificationTokens, sessions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Find the magic link token
    const magicToken = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1);

    if (magicToken.length === 0) {
      return NextResponse.json(
        { error: "Invalid magic link" },
        { status: 400 }
      );
    }

    const tokenData = magicToken[0]!;

    // Check if token is a magic link token (has "magic:" prefix)
    if (!tokenData.identifier.startsWith("magic:")) {
      return NextResponse.json(
        { error: "Invalid magic link" },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (new Date(tokenData.expires) < new Date()) {
      // Delete expired token
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token));

      return NextResponse.json(
        { error: "Magic link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Extract email from identifier (remove "magic:" prefix)
    const email = tokenData.identifier.substring(6);

    // Find the user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = user[0]!;

    // Check if user has a password (OAuth user check)
    if (!userData.password) {
      // Delete the token since we're not using it
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, token));

      return NextResponse.json(
        { error: "OAUTH_USER", message: "This account uses Google sign-in" },
        { status: 400 }
      );
    }

    // Delete the used token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token));

    // Create a session for the user
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 30); // Session expires in 30 days

    await db.insert(sessions).values({
      sessionToken,
      userId: userData.id,
      expires: sessionExpiry,
    });

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("authjs.session-token", sessionToken, {
      expires: sessionExpiry,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return NextResponse.json({
      message: "Magic link verified successfully",
      email: userData.email,
    });
  } catch (error) {
    console.error("Magic link verification error:", error);
    return NextResponse.json(
      { error: "Unable to verify magic link. Please try again." },
      { status: 500 }
    );
  }
}