import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, bookFeatures } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { promises as fs } from "fs";
import path from "path";

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
        errorMessage += " Report exists but has no HTML content. Please re-upload the report.";
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

    // Check if HTML already has embedded images (data URLs)
    const hasEmbeddedImages = report.htmlContent.includes('data:image/');
    
    let htmlContent = report.htmlContent;
    
    // If images aren't embedded, bundle them now
    if (!hasEmbeddedImages) {
      console.log(`[Report View] Bundling images for report ${bookId} on-the-fly`);
      
      // Build search directories for images
      const searchDirs: string[] = [];
      
      // 1. Report storage directory
      const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
      try {
        await fs.access(reportStoragePath);
        searchDirs.push(reportStoragePath);
      } catch {
        // Directory doesn't exist, skip
      }
      
      // 2. Book reports directory (only if env var is set, don't use hardcoded local path)
      const bookReportsPath = process.env.BOOK_REPORTS_PATH;
      if (bookReportsPath) {
        try {
          await fs.access(bookReportsPath);
          searchDirs.push(bookReportsPath);
          
          // Also try subdirectories
          const entries = await fs.readdir(bookReportsPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              searchDirs.push(path.join(bookReportsPath, entry.name));
            }
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }
      
      if (searchDirs.length > 0) {
        htmlContent = await bundleReportHtmlFromContent(report.htmlContent, searchDirs);
        console.log(`[Report View] Successfully bundled images for report ${bookId}`);
        
        // Update database with bundled HTML so we don't have to bundle on every request
        // Only update if bundling was successful and HTML changed
        if (htmlContent !== report.htmlContent) {
          try {
            await db
              .update(reports)
              .set({ htmlContent })
              .where(eq(reports.id, report.id));
            console.log(`[Report View] Updated database with bundled HTML for report ${report.id}`);
          } catch (error) {
            console.error(`[Report View] Failed to update database with bundled HTML:`, error);
            // Continue serving bundled HTML even if DB update fails
          }
        }
      } else {
        console.warn(`[Report View] No image search directories available for report ${bookId} (this is normal on Render if BOOK_REPORTS_PATH is not set)`);
      }
    }

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

