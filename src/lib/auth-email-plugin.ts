import type { Plugin } from "better-auth/plugin";
import { sendEmail } from "@/server/services/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Better Auth plugin to use Resend for sending emails
 * This plugin intercepts Better Auth's email sending and uses our Resend service
 */
export function emailPlugin(): Plugin {
  return {
    id: "resend-email",
    // Hook into Better Auth's email sending
    email: {
      async send({ email, type, props }) {
        console.log("📧 [Email Plugin] Email send called!");
        console.log("📧 [Email Plugin] Type:", type);
        console.log("📧 [Email Plugin] Email object:", JSON.stringify(email, null, 2));
        console.log("📧 [Email Plugin] Props:", JSON.stringify(props, null, 2));

        const { to, subject, html, text } = email;

        // For email verification, Better Auth provides the token in props
        if (type === "email-verification") {
          console.log("📧 [Email Plugin] Processing email verification email");
          const token = props?.token as string | undefined;
          if (!token) {
            console.error("[Better Auth Email] No token provided for email verification");
            return { success: false };
          }

          const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;

          // Use our custom verification email template
          const customHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <title>Verify Your Email</title>
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
                    <h2>Verify Your Email Address</h2>
                    <p>Welcome to Get Lost! Please verify your email to complete your registration.</p>

                    <a href="${verificationUrl}" class="button" style="color: white !important;">Verify Email</a>

                    <p class="expire-text">This link will expire in 24 hours</p>
                  </div>

                  <div class="footer">
                    <p style="margin: 0;">If you didn't create an account with Get Lost, you can safely ignore this email.</p>
                    <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `;

          const emailSent = await sendEmail({
            to,
            subject: subject || "Verify your email for Get Lost",
            html: customHtml,
            text: `Welcome to Get Lost! Please verify your email by clicking this link: ${verificationUrl}`,
          });

          return { success: emailSent };
        }

        // For other email types (password reset, etc.), use Better Auth's default template
        // but send via Resend
        const emailSent = await sendEmail({
          to,
          subject: subject || "Get Lost",
          html: html || text || "",
          text: text || html?.replace(/<[^>]*>/g, "") || "",
        });

        return { success: emailSent };
      },
    },
  };
}

