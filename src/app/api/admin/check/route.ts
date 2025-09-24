import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ isAdmin: false });
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  const isAdmin = session.user.role === "admin" || adminEmails.includes(session.user.email || "");

  return NextResponse.json({ isAdmin });
}