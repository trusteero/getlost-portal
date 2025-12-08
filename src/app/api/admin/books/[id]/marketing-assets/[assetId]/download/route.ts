import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, marketingAssets } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/marketing-assets/[assetId]/download
 * Admin-only route to download a specific marketing asset version
 * Returns the marketing asset as an HTML file download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: bookId, assetId } = await params;
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUserRole = (session.user as any)?.role;
  if (currentUserRole !== "admin" && currentUserRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get the book (no ownership check for admin)
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the specific marketing asset
    const [asset] = await db
      .select({
        id: marketingAssets.id,
        metadata: marketingAssets.metadata,
        createdAt: marketingAssets.createdAt,
      })
      .from(marketingAssets)
      .where(eq(marketingAssets.id, assetId))
      .limit(1);

    if (!asset || !asset.metadata) {
      return NextResponse.json(
        { error: "Marketing asset not found" },
        { status: 404 }
      );
    }

    // Parse metadata to get HTML content
    let htmlContent: string | null = null;
    try {
      const metadata = JSON.parse(asset.metadata);
      htmlContent = metadata.htmlContent || null;
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid marketing asset metadata" },
        { status: 500 }
      );
    }

    if (!htmlContent) {
      return NextResponse.json(
        { error: "Marketing asset HTML content not available" },
        { status: 404 }
      );
    }

    // Create a sanitized filename
    const bookTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = asset.createdAt
      ? new Date(asset.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const filename = `marketing_${bookTitle}_${dateStr}.html`;

    // Return HTML as downloadable file
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[Admin Marketing Asset Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download marketing asset" },
      { status: 500 }
    );
  }
}

