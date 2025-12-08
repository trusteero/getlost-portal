import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, reports } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/reports/[reportId]/download
 * Admin-only route to download a specific report version
 * Returns the report as an HTML file download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id: bookId, reportId } = await params;
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

    // Get the specific report
    const [report] = await db
      .select({
        id: reports.id,
        htmlContent: reports.htmlContent,
        status: reports.status,
        completedAt: reports.completedAt,
      })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (!report.htmlContent) {
      return NextResponse.json(
        { error: "Report HTML content not available" },
        { status: 404 }
      );
    }

    // Create a sanitized filename
    const bookTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = report.completedAt
      ? new Date(report.completedAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const filename = `report_${bookTitle}_${dateStr}.html`;

    // Return HTML as downloadable file
    return new NextResponse(report.htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[Admin Report Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 }
    );
  }
}

