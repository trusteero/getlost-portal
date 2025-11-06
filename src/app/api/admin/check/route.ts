import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ isAdmin: false });
  }

  // Check if user is admin or super_admin
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";

  return NextResponse.json({ isAdmin });
}