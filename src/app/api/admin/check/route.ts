import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  return NextResponse.json({ isAdmin });
}