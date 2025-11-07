import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check for session cookie for protected routes
  const protectedPaths = ["/dashboard", "/admin", "/settings"];
  const authPaths = ["/login", "/signup"];

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Better Auth uses cookiePrefix.session_token format
  // With cookiePrefix: "better-auth", the cookie is "better-auth.session_token"
  // But Better Auth might also use different formats, so check multiple variations
  const allCookies = request.cookies.getAll();
  const sessionCookie = allCookies.find(cookie => 
    cookie.name.includes('session') && cookie.name.includes('better-auth')
  ) || request.cookies.get("better-auth.session_token") ||
    request.cookies.get("better-auth_session_token") ||
    request.cookies.get("better-auth.session-token") ||
    request.cookies.get("better-auth_session-token");

  // Don't check protected paths in middleware - let page components handle auth
  // This prevents false redirects when cookies aren't detected properly
  // The page components use useSession() which properly verifies the session
  
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
