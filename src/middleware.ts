import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Don't check protected paths in middleware - let page components handle auth
  // This prevents false redirects when cookies aren't detected properly
  // The page components use useSession() which properly verifies the session
  
  // For auth paths (login/signup), don't redirect in middleware - let the page component handle it
  // This allows logout to work properly even if cookies aren't immediately cleared
  // The login page will check for valid sessions and redirect if needed

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
