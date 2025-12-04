import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session?.user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    
    return NextResponse.json({ 
      user: session.user,
      session: session.session 
    });
  } catch (error: any) {
    console.error("[Get Session API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get session", message: error?.message },
      { status: 500 }
    );
  }
}

