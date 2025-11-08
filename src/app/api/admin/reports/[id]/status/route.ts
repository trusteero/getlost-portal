import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id } = await params;

  if (!isAdmin) {
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
      .where(eq(reports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update report status:", error);
    return NextResponse.json({ error: "Failed to update report status" }, { status: 500 });
  }
}