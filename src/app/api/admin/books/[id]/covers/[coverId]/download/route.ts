import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookCovers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/covers/[coverId]/download
 * Admin-only route to download a specific cover version
 * Returns the cover as HTML (if HTML gallery) or redirects to image URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; coverId: string }> }
) {
  const { id: bookId, coverId } = await params;
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

    // Get the specific cover
    const [cover] = await db
      .select({
        id: bookCovers.id,
        title: bookCovers.title,
        imageUrl: bookCovers.imageUrl,
        thumbnailUrl: bookCovers.thumbnailUrl,
        metadata: bookCovers.metadata,
        createdAt: bookCovers.createdAt,
      })
      .from(bookCovers)
      .where(eq(bookCovers.id, coverId))
      .limit(1);

    if (!cover) {
      return NextResponse.json({ error: "Cover not found" }, { status: 404 });
    }

    // Check if it's an HTML-based cover gallery
    if (cover.metadata) {
      try {
        const metadata = JSON.parse(cover.metadata);
        if (metadata.variant === "html" && metadata.htmlContent) {
          // Return HTML as downloadable file
          const bookTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const dateStr = cover.createdAt
            ? new Date(cover.createdAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          const filename = `covers_${bookTitle}_${dateStr}.html`;

          return new NextResponse(metadata.htmlContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      } catch (parseError) {
        // Not HTML, continue to image download
      }
    }

    // For image-based covers, redirect to the image URL or return it
    const imageUrl = cover.imageUrl || cover.thumbnailUrl;
    if (imageUrl) {
      // Return a redirect to the image
      return NextResponse.redirect(imageUrl);
    }

    return NextResponse.json(
      { error: "Cover content not available" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[Admin Cover Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download cover" },
      { status: 500 }
    );
  }
}

