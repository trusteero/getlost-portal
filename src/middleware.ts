import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { betterFetch } from "better-auth/client";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check for session cookie for protected routes
  const protectedPaths = ["/dashboard", "/admin", "/settings"];
  const authPaths = ["/login", "/signup"];

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Get session cookie
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (isProtectedPath && !sessionCookie) {
    // Redirect to login if trying to access protected route without session
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPath && sessionCookie) {
    // Redirect to dashboard if trying to access auth pages with session
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