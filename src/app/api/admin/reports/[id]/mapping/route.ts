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
    const body = await request.json();
    const uploadFileNames = Array.isArray(body.uploadFileNames)
      ? body.uploadFileNames
      : [];

    const sanitizedNames = uploadFileNames
      .map((value: unknown) =>
        typeof value === "string" ? value.trim() : ""
      )
      .filter((value: string, index: number, array: string[]) => value.length > 0 && array.indexOf(value) === index);

    const [existing] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    let adminNotes: Record<string, unknown> = {};
    if (existing.adminNotes) {
      try {
        adminNotes = JSON.parse(existing.adminNotes);
      } catch {
        adminNotes = {};
      }
    }

    adminNotes.uploadFileNames = sanitizedNames;

    await db
      .update(reports)
      .set({
        adminNotes: JSON.stringify(adminNotes),
      })
      .where(eq(reports.id, id));

    return NextResponse.json({
      success: true,
      uploadFileNames: sanitizedNames,
    });
  } catch (error) {
    console.error("Failed to update report mappings:", error);
    return NextResponse.json(
      { error: "Failed to update report mappings" },
      { status: 500 }
    );
  }
}


