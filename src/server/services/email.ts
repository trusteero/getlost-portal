interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  if (!RESEND_API_KEY) {
    console.error("Resend API key not configured");
    // In development, just log the email
    if (process.env.NODE_ENV === "development") {
      console.log("📧 [Email] Would be sent:", { to, subject });
      console.log("📧 [Email] HTML preview:", html.substring(0, 200) + "...");
      return true;
    }
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
      }),
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {
        error = { message: await response.text() };
      }
      console.error("Resend API error:", error);
      return false;
    }

    const data = await response.json();
    console.log("📧 [Email] Sent successfully:", { to, id: data.id });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${APP_URL}/auth/verify-email?token=${token}`;

  const html = `
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
            <h2>Verify Your Email Address</h2>
            <p>Welcome to Get Lost! Please verify your email to complete your registration.</p>

            <a href="${verificationUrl}" class="button" style="color: white !important;">Verify Email</a>

            <div class="url-box">
              ${verificationUrl}
            </div>

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

  return sendEmail({
    to: email,
    subject: "Verify your email for Get Lost",
    html,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Reset Your Password</title>
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
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>

            <a href="${resetUrl}" class="button" style="color: white !important;">Reset Password</a>

            <div class="url-box">
              ${resetUrl}
            </div>

            <p class="expire-text">This link will expire in 1 hour</p>

            <p style="color: #9ca3af; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>

          <div class="footer">
            <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Reset your password for Get Lost",
    html,
  });
}

export async function sendWelcomeEmail(email: string, name?: string) {
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Welcome to Get Lost</title>
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
          .features {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
            text-align: left;
          }
          .feature {
            margin: 12px 0;
            padding-left: 24px;
            position: relative;
            color: #4b5563;
            font-size: 14px;
          }
          .feature::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #ea580c;
            font-weight: bold;
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
            <h2>Welcome${name ? `, ${name}` : ''}!</h2>
            <p>Your account is ready. Let's discover your book's unique fingerprint.</p>

            <div class="features">
              <div class="feature">Upload manuscripts in TXT, DOCX, PDF, or EPUB format</div>
              <div class="feature">Get your book's digital fingerprint</div>
              <div class="feature">Discover your target audience</div>
              <div class="feature">Receive marketing strategies and insights</div>
            </div>

            <a href="${dashboardUrl}" class="button" style="color: white !important;">Go to Dashboard</a>
          </div>

          <div class="footer">
            <p style="margin: 0;">Happy writing!</p>
            <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Welcome to Get Lost!",
    html,
  });
}

export async function sendManuscriptQueuedEmail(email: string, bookTitle: string, userName?: string) {
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Manuscript Queued</title>
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
          .book-title {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            font-weight: 600;
            color: #111827;
            font-size: 18px;
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
            <h2>Manuscript Queued</h2>
            <p>${userName ? `Hi ${userName},` : 'Hi,'}</p>
            <p>Your manuscript has been successfully uploaded and is now in our queue for processing.</p>
            
            <div class="book-title">"${bookTitle}"</div>
            
            <p>Our team will begin working on your report soon. You'll receive an email notification when we start processing your manuscript.</p>

            <a href="${dashboardUrl}" class="button" style="color: white !important;">View Dashboard</a>
          </div>

          <div class="footer">
            <p style="margin: 0;">Thank you for using Get Lost!</p>
            <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Your manuscript "${bookTitle}" has been queued`,
    html,
  });
}

export async function sendManuscriptInProgressEmail(email: string, bookTitle: string, userName?: string) {
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Manuscript In Progress</title>
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
          .book-title {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            font-weight: 600;
            color: #111827;
            font-size: 18px;
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
            <h2>We're Working on Your Report</h2>
            <p>${userName ? `Hi ${userName},` : 'Hi,'}</p>
            <p>Great news! Our team has started working on your manuscript report.</p>
            
            <div class="book-title">"${bookTitle}"</div>
            
            <p>We're analyzing your manuscript and preparing a comprehensive report. You'll receive another email notification once your report is ready.</p>

            <a href="${dashboardUrl}" class="button" style="color: white !important;">View Dashboard</a>
          </div>

          <div class="footer">
            <p style="margin: 0;">Thank you for using Get Lost!</p>
            <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `We're working on your report for "${bookTitle}"`,
    html,
  });
}

export async function sendReportReadyEmail(email: string, bookTitle: string, bookId: string, userName?: string) {
  const reportUrl = `${APP_URL}/dashboard/book/${bookId}#report`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Report Ready</title>
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
          .book-title {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            font-weight: 600;
            color: #111827;
            font-size: 18px;
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
            <h2>Your Report is Ready!</h2>
            <p>${userName ? `Hi ${userName},` : 'Hi,'}</p>
            <p>Your comprehensive manuscript report has been completed and is ready for you to view.</p>
            
            <div class="book-title">"${bookTitle}"</div>
            
            <p>Click the button below to view your report and discover insights about your manuscript.</p>

            <a href="${reportUrl}" class="button" style="color: white !important;">View Report</a>
          </div>

          <div class="footer">
            <p style="margin: 0;">Thank you for using Get Lost!</p>
            <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Your report for "${bookTitle}" is ready!`,
    html,
  });
}