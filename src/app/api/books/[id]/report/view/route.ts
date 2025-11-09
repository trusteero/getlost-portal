import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/books/[id]/report/view
 * Returns the report HTML content directly (not as JSON)
 * This avoids JSON response size limits for large HTML files
 * Bundles images on-the-fly if not already bundled
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
      
      // 2. Book reports directory
      const bookReportsPath = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";
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
      
      if (searchDirs.length > 0) {
        htmlContent = await bundleReportHtmlFromContent(report.htmlContent, searchDirs);
        console.log(`[Report View] Successfully bundled images for report ${bookId}`);
      } else {
        console.warn(`[Report View] No image search directories available for report ${bookId}`);
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

