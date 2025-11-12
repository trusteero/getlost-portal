import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { bookCovers } from "@/server/db/schema";
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
    const { uploadFileNames } = body;

    if (!Array.isArray(uploadFileNames)) {
      return NextResponse.json(
        { error: "uploadFileNames must be an array" },
        { status: 400 }
      );
    }

    // Get existing cover
    const [existingCover] = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.id, id))
      .limit(1);

    if (!existingCover) {
      return NextResponse.json({ error: "Cover not found" }, { status: 404 });
    }

    // Parse existing metadata
    let metadata: Record<string, unknown> = {};
    try {
      if (existingCover.metadata) {
        metadata = JSON.parse(existingCover.metadata);
      }
    } catch {
      // Invalid JSON, start fresh
    }

    // Sanitize and set uploadFileNames
    const sanitizedNames = uploadFileNames
      .map((value: unknown) =>
        typeof value === "string" ? value.trim() : ""
      )
      .filter((value: string, index: number, array: string[]) => value.length > 0 && array.indexOf(value) === index);

    metadata.uploadFileNames = sanitizedNames;

    // Update cover
    await db
      .update(bookCovers)
      .set({
        metadata: JSON.stringify(metadata),
        updatedAt: new Date(),
      })
      .where(eq(bookCovers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update cover mapping:", error);
    return NextResponse.json(
      { error: "Failed to update mapping" },
      { status: 500 }
    );
  }
}

