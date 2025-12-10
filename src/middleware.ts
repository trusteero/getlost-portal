import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Don't check protected paths in middleware - let page components handle auth
  // This prevents false redirects when cookies aren't detected properly
  // The page components use useSession() which properly verifies the session
  
  // For auth paths (login/signup), don't redirect in middleware - let the page component handle it
  // This allows logout to work properly even if cookies aren't immediately cleared
  // The login page will check for valid sessions and redirect if needed

  // Create response
  const response = NextResponse.next();

  // Security headers for all responses
  // These protect against common web vulnerabilities

  // Prevent clickjacking - allow same-origin for iframes (needed for reports/covers display)
  // DENY would break iframe functionality, so we use SAMEORIGIN
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy - restrict access to browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Strict Transport Security (HSTS) - only in production with HTTPS
  if (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy
  // Permissive enough to allow:
  // - Inline scripts/styles (Next.js requires this)
  // - Same-origin iframes (for reports/covers display)
  // - Stripe (for payments)
  // - Google OAuth
  // - Self-hosted assets
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com", // unsafe-eval needed for Next.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // unsafe-inline needed for Next.js
    "img-src 'self' data: https: blob:", // Allow images from anywhere (for covers, reports, etc.)
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://api.stripe.com https://accounts.google.com https://*.googleapis.com wss:", // WebSocket for dev
    "frame-src 'self'", // Allow same-origin iframes (for reports/covers)
    "frame-ancestors 'self'", // Allow embedding in same-origin
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // XSS Protection (legacy, but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
