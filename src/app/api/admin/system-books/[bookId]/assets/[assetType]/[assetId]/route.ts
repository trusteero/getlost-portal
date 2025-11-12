import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { marketingAssets, bookCovers, landingPages } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/admin/system-books/[bookId]/assets/[assetType]/[assetId]
 * Delete an asset
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; assetType: string; assetId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { bookId, assetType, assetId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (assetType === "marketing-assets") {
      await db.delete(marketingAssets).where(eq(marketingAssets.id, assetId));
    } else if (assetType === "covers") {
      await db.delete(bookCovers).where(eq(bookCovers.id, assetId));
    } else if (assetType === "landing-page") {
      await db.delete(landingPages).where(eq(landingPages.id, assetId));
    } else {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}




