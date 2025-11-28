import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { landingPages } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; landingPageId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id, landingPageId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db
      .delete(landingPages)
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.bookId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete landing page:", error);
    return NextResponse.json(
      { error: "Failed to delete landing page" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; landingPageId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id, landingPageId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { isActive } = body;

    // If setting as active, unset all other active landing pages for this book
    if (isActive === true) {
      await db
        .update(landingPages)
        .set({ isActive: false })
        .where(eq(landingPages.bookId, id));
    }

    // Update this landing page
    await db
      .update(landingPages)
      .set({
        isActive: isActive === true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(landingPages.id, landingPageId),
          eq(landingPages.bookId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update landing page:", error);
    return NextResponse.json(
      { error: "Failed to update landing page" },
      { status: 500 }
    );
  }
}

