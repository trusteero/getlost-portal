import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check for session cookie for protected routes
  const protectedPaths = ["/dashboard", "/admin", "/settings"];
  const authPaths = ["/login", "/signup"];

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // For protected paths, verify session via Better Auth
  if (isProtectedPath) {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });
      
      if (!session) {
        // Redirect to login if trying to access protected route without session
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      // If session check fails, redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For auth paths, check if already logged in
  if (isAuthPath) {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });
      
      if (session) {
        // Redirect to dashboard if trying to access auth pages with session
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch (error) {
      // If session check fails, allow access to auth pages
    }
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
