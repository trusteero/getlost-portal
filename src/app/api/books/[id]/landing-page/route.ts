import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, landingPages, bookFeatures } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/landing-page
 * Get landing page for a book
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify book ownership
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book[0]!.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get landing page FIRST - if assets exist, allow access (admin may have uploaded)
    // Get landing page - prefer active one
    let landingPage = await db
      .select()
      .from(landingPages)
      .where(
        and(
          eq(landingPages.bookId, id),
          eq(landingPages.isActive, true)
        )
      )
      .limit(1);

    // If no active landing page, get any landing page
    if (landingPage.length === 0) {
      landingPage = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.bookId, id))
        .limit(1);
    }

    if (landingPage.length === 0 || !landingPage[0]) {
      // If no landing page exists, check if feature is unlocked (purchase required)
      const feature = await db
        .select()
        .from(bookFeatures)
        .where(
          and(
            eq(bookFeatures.bookId, id),
            eq(bookFeatures.featureType, "landing-page")
          )
        )
        .limit(1);

      if (feature.length === 0 || feature[0]!.status === "locked") {
        return NextResponse.json(
          { error: "Landing page not found. Please purchase the landing page feature first." },
          { status: 404 }
        );
      }
      
      // Feature is unlocked but no landing page uploaded yet
      return NextResponse.json({ error: "Landing page not found. Landing page is being prepared." }, { status: 404 });
    }

    const page = landingPage[0];

    // Update viewedAt timestamp when user views the landing page
    await db
      .update(landingPages)
      .set({ viewedAt: new Date() })
      .where(eq(landingPages.id, page.id));

    // Clean localhost URLs from HTML content
    if (page.htmlContent && typeof page.htmlContent === 'string') {
      // Replace any hardcoded localhost URLs with relative paths
      page.htmlContent = page.htmlContent.replace(
        /https?:\/\/localhost:\d+\//gi,
        '/'
      );
      page.htmlContent = page.htmlContent.replace(
        /https?:\/\/127\.0\.0\.1:\d+\//gi,
        '/'
      );
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error("Failed to get landing page:", error);
    return NextResponse.json(
      { error: "Failed to get landing page" },
      { status: 500 }
    );
  }
}

