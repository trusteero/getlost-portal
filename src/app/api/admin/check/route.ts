import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  return NextResponse.json({ isAdmin });
}