import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/server/services/email";

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
      // Delete any existing magic link tokens for this email
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, `magic:${email.toLowerCase()}`));

      // Generate magic link token
      const magicToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date();
      expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

      // Store magic link token with "magic:" prefix to differentiate from other tokens
      await db.insert(verificationTokens).values({
        identifier: `magic:${email.toLowerCase()}`,
        token: magicToken,
        expires: expires,
      });

      // Send magic link email
      const magicUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/magic-verify?token=${magicToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Sign in to Get Lost</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f9fafb;
                margin: 0;
                padding: 20px;
              }
              .container {
                background: white;
                border-radius: 12px;
                padding: 48px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .content {
                text-align: center;
              }
              h2 {
                font-size: 24px;
                font-weight: 600;
                color: #111827;
                margin: 0 0 16px;
              }
              p {
                color: #6b7280;
                margin: 0 0 24px;
                font-size: 16px;
              }
              .button {
                display: inline-block;
                padding: 16px 48px;
                background-color: #ea580c;
                color: white !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                margin: 24px 0;
                transition: background-color 0.2s;
              }
              .button:hover {
                background-color: #dc2626;
              }
              .url-box {
                background: #f3f4f6;
                padding: 12px;
                border-radius: 6px;
                margin: 24px 0;
                word-break: break-all;
                font-size: 13px;
                color: #6b7280;
              }
              .expire-text {
                color: #9ca3af;
                font-size: 14px;
                margin: 16px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 24px;
                border-top: 1px solid #e5e7eb;
                font-size: 13px;
                color: #9ca3af;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <h2>Sign in to Get Lost</h2>
                <p>Click the button below to instantly sign in to your account:</p>

                <a href="${magicUrl}" class="button" style="color: white !important;">Sign In</a>

                <div class="url-box">
                  ${magicUrl}
                </div>

                <p class="expire-text">This link will expire in 1 hour</p>
              </div>

              <div class="footer">
                <p style="margin: 0;">If you didn't request this email, you can safely ignore it.</p>
                <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const emailSent = await sendEmail({
        to: email.toLowerCase(),
        subject: "Sign in to Get Lost",
        html,
      });

      if (!emailSent) {
        console.error("Failed to send magic link email to:", email);
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with this email, a magic link has been sent.",
    });
  } catch (error) {
    console.error("Magic link request error:", error);
    return NextResponse.json(
      { error: "Unable to process magic link request. Please try again." },
      { status: 500 }
    );
  }
}