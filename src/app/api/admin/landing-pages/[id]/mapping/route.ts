import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { landingPages } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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

    // Get existing landing page
    const [existingPage] = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.id, id))
      .limit(1);

    if (!existingPage) {
      return NextResponse.json({ error: "Landing page not found" }, { status: 404 });
    }

    // Parse existing metadata
    let metadata: Record<string, unknown> = {};
    try {
      if (existingPage.metadata) {
        metadata = JSON.parse(existingPage.metadata);
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

    // Update landing page
    await db
      .update(landingPages)
      .set({
        metadata: JSON.stringify(metadata),
        updatedAt: new Date(),
      })
      .where(eq(landingPages.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update landing page mapping:", error);
    return NextResponse.json(
      { error: "Failed to update mapping" },
      { status: 500 }
    );
  }
}

