import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Create redirect response to login
  const response = NextResponse.redirect(new URL("/login", request.url));

  // Clear all possible auth cookies
  const cookiesToClear = [
    "authjs.csrf-token",
    "authjs.callback-url",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "__Host-authjs.csrf-token",
    "__Host-next-auth.csrf-token"
  ];

  cookiesToClear.forEach(cookieName => {
    response.cookies.set(cookieName, "", {
      expires: new Date(0),
      path: "/",
      secure: false, // Allow clearing in development
      sameSite: "lax"
    });
    // Also try to delete without setting
    response.cookies.delete(cookieName);
  });

  return response;
}