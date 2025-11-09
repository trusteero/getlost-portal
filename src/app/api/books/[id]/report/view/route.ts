import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/report/view
 * Returns the report HTML content directly (not as JSON)
 * This avoids JSON response size limits for large HTML files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id: bookId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify the user owns this book
    const [book] = await db
      .select({
        id: books.id,
        userId: books.userId,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book || book.userId !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the latest version of the book
    const [latestVersion] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, bookId))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json({ error: "No book version found" }, { status: 404 });
    }

    // Get the latest completed report for this version
    const [report] = await db
      .select({
        htmlContent: reports.htmlContent,
      })
      .from(reports)
      .where(and(
        eq(reports.bookVersionId, latestVersion.id),
        eq(reports.status, "completed")
      ))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    if (!report || !report.htmlContent) {
      return NextResponse.json({ error: "No completed report found" }, { status: 404 });
    }

    // Return HTML directly with proper headers
    return new NextResponse(report.htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("Failed to fetch report HTML:", error);
    return NextResponse.json(
      { error: "Failed to fetch report HTML" },
      { status: 500 }
    );
  }
}

