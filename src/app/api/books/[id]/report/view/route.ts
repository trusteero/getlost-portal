import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, bookFeatures } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/report/view
 * Returns the report HTML content directly (not as JSON)
 * This avoids JSON response size limits for large HTML files
 * Bundles images on-the-fly if not already bundled
 * 
 * Requires: manuscript-report feature to be unlocked
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

    // Check if manuscript-report feature is unlocked
    const [feature] = await db
      .select()
      .from(bookFeatures)
      .where(
        and(
          eq(bookFeatures.bookId, bookId),
          eq(bookFeatures.featureType, "manuscript-report")
        )
      )
      .limit(1);

    if (!feature || feature.status === "locked") {
      return NextResponse.json(
        { error: "Feature not unlocked. Please purchase the manuscript report first." },
        { status: 403 }
      );
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

    // Get all reports for this version (for debugging)
    const allReports = await db
      .select({
        id: reports.id,
        status: reports.status,
        htmlContent: reports.htmlContent,
        requestedAt: reports.requestedAt,
        completedAt: reports.completedAt,
      })
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.requestedAt));

    console.log(`[Report View] Found ${allReports.length} report(s) for version ${latestVersion.id}:`, 
      allReports.map(r => ({ id: r.id, status: r.status, hasHtml: !!r.htmlContent })));

    // Get the latest completed report for this version
    const [report] = await db
      .select({
        id: reports.id,
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
      // Provide more detailed error information
      const hasAnyReport = allReports.length > 0;
      const hasCompletedReport = allReports.some(r => r.status === "completed");
      const hasReportWithoutHtml = allReports.some(r => r.status === "completed" && !r.htmlContent);
      
      let errorMessage = "No completed report found.";
      if (!hasAnyReport) {
        errorMessage += " No reports exist for this book version. Please upload a report or run the seed script.";
      } else if (!hasCompletedReport) {
        const statuses = allReports.map(r => r.status).join(", ");
        errorMessage += ` Found ${allReports.length} report(s) but none are completed. Status(es): ${statuses}`;
      } else if (hasReportWithoutHtml) {
        errorMessage += " Report exists but has no HTML content in database. Please re-upload the report via admin interface or run the seed script.";
      } else {
        errorMessage += " The report may still be processing or hasn't been uploaded yet.";
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          debug: {
            versionId: latestVersion.id,
            reportCount: allReports.length,
            reportStatuses: allReports.map(r => ({ id: r.id, status: r.status, hasHtml: !!r.htmlContent }))
          }
        },
        { status: 404 }
      );
    }

    // HTML content should already be bundled with images when stored in database
    // All data comes from database, no file system access needed
    const htmlContent = report.htmlContent;

    // Return HTML directly with proper headers
    return new NextResponse(htmlContent, {
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

