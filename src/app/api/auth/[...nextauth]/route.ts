import { handlers } from "@/server/auth";
import { NextRequest, NextResponse } from "next/server";

const { GET: AuthGET, POST: AuthPOST } = handlers;

export async function GET(request: NextRequest) {
  try {
    return await AuthGET(request);
  } catch (error: any) {
    // If it's a JWT error, clear cookies and redirect
    if (error?.message?.includes("JWEInvalid") || error?.message?.includes("JWTSessionError")) {
      const response = NextResponse.redirect(new URL("/login", request.url));

      // Clear all auth cookies
      const cookiesToClear = [
        "authjs.csrf-token",
        "authjs.callback-url",
        "authjs.session-token",
        "__Secure-authjs.session-token",
        "next-auth.csrf-token",
        "next-auth.callback-url",
        "next-auth.session-token",
        "__Secure-next-auth.session-token"
      ];

      cookiesToClear.forEach(cookieName => {
        response.cookies.set(cookieName, "", {
          expires: new Date(0),
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax"
        });
      });

      return response;
    }

    // For other errors, return them as-is
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    return await AuthPOST(request);
  } catch (error: any) {
    // If it's a JWT error during POST (signin), handle it
    if (error?.message?.includes("JWEInvalid") || error?.message?.includes("JWTSessionError")) {
      const response = NextResponse.json(
        { error: "Session expired. Please try again." },
        { status: 401 }
      );

      // Clear all auth cookies
      const cookiesToClear = [
        "authjs.csrf-token",
        "authjs.callback-url",
        "authjs.session-token",
        "__Secure-authjs.session-token",
        "next-auth.csrf-token",
        "next-auth.callback-url",
        "next-auth.session-token",
        "__Secure-next-auth.session-token"
      ];

      cookiesToClear.forEach(cookieName => {
        response.cookies.set(cookieName, "", {
          expires: new Date(0),
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax"
        });
      });

      return response;
    }

    throw error;
  }
}
