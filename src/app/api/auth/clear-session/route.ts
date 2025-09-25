import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  // Clear all auth-related cookies
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("authjs.callback-url");
  cookieStore.delete("__Secure-authjs.callback-url");
  cookieStore.delete("authjs.csrf-token");
  cookieStore.delete("__Secure-authjs.csrf-token");

  return NextResponse.json({ message: "Session cleared" });
}

export async function POST() {
  const cookieStore = await cookies();

  // Clear all auth-related cookies
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("authjs.callback-url");
  cookieStore.delete("__Secure-authjs.callback-url");
  cookieStore.delete("authjs.csrf-token");
  cookieStore.delete("__Secure-authjs.csrf-token");

  return NextResponse.json({ message: "Session cleared" });
}