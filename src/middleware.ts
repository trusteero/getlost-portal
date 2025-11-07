import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Explicitly set Edge Runtime
export const runtime = 'edge';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check for session cookie for protected routes
  const protectedPaths = ["/dashboard", "/admin", "/settings"];
  const authPaths = ["/login", "/signup"];

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Better Auth cookie name format: {cookiePrefix}.session_token
  // With cookiePrefix: "better-auth", it should be "better-auth.session_token"
  // Check for session cookie - Better Auth sets this automatically
  const sessionCookie = 
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("better-auth_session_token") ||
    request.cookies.get("better-auth.session-token") ||
    request.cookies.get("better-auth_session-token");

  // For protected paths, check if session cookie exists
  // The actual session verification will happen in the page component
  if (isProtectedPath && !sessionCookie) {
    // Redirect to login if trying to access protected route without session cookie
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For auth paths, redirect to dashboard if session cookie exists
  if (isAuthPath && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
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
