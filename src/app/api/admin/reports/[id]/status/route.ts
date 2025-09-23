import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { reports } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  if (session.user.role !== "admin" && !adminEmails.includes(session.user.email || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { status } = await request.json();

    if (!["analyzing", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: any = {
      status,
      analyzedBy: session.user.email,
    };

    if (status === "analyzing") {
      updateData.startedAt = new Date();
    } else if (status === "completed") {
      updateData.completedAt = new Date();
    }

    await db
      .update(reports)
      .set(updateData)
      .where(eq(reports.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update report status:", error);
    return NextResponse.json({ error: "Failed to update report status" }, { status: 500 });
  }
}