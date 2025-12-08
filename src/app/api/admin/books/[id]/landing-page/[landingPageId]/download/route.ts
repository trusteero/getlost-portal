import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, landingPages } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/landing-page/[landingPageId]/download
 * Admin-only route to download a specific landing page version
 * Returns the landing page as an HTML file download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; landingPageId: string }> }
) {
  const { id: bookId, landingPageId } = await params;
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

    // Get the specific landing page
    const [page] = await db
      .select({
        id: landingPages.id,
        htmlContent: landingPages.htmlContent,
        createdAt: landingPages.createdAt,
      })
      .from(landingPages)
      .where(eq(landingPages.id, landingPageId))
      .limit(1);

    if (!page) {
      return NextResponse.json({ error: "Landing page not found" }, { status: 404 });
    }

    if (!page.htmlContent) {
      return NextResponse.json(
        { error: "Landing page HTML content not available" },
        { status: 404 }
      );
    }

    // Create a sanitized filename
    const bookTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = page.createdAt
      ? new Date(page.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const filename = `landing-page_${bookTitle}_${dateStr}.html`;

    // Return HTML as downloadable file
    return new NextResponse(page.htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[Admin Landing Page Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download landing page" },
      { status: 500 }
    );
  }
}

