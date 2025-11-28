import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { marketingAssets } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id, assetId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db
      .delete(marketingAssets)
      .where(
        and(
          eq(marketingAssets.id, assetId),
          eq(marketingAssets.bookId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete marketing asset:", error);
    return NextResponse.json(
      { error: "Failed to delete marketing asset" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id, assetId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { isActive } = body;

    // If setting as active, unset all other active assets for this book
    if (isActive === true) {
      await db
        .update(marketingAssets)
        .set({ isActive: false })
        .where(eq(marketingAssets.bookId, id));
    }

    // Update this asset
    await db
      .update(marketingAssets)
      .set({
        isActive: isActive === true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketingAssets.id, assetId),
          eq(marketingAssets.bookId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update marketing asset:", error);
    return NextResponse.json(
      { error: "Failed to update marketing asset" },
      { status: 500 }
    );
  }
}

