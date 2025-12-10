import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports, bookVersions, books } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { promises as fs } from "fs";
import path from "path";
import { getEnvWithFallback } from "@/server/utils/validate-env";

/**
 * POST /api/books/[id]/report/bundle
 * Bundle a report's HTML into a single-file version with embedded images
 */
export async function POST(
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
        title: books.title,
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
      .select()
      .from(reports)
      .where(and(
        eq(reports.bookVersionId, latestVersion.id),
        eq(reports.status, "completed")
      ))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "No completed report found" }, { status: 404 });
    }

    if (!report.htmlContent) {
      return NextResponse.json({ error: "Report has no HTML content" }, { status: 400 });
    }

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
    // In production, require BOOK_REPORTS_PATH to be set (no hardcoded fallback)
    const bookReportsPath = getEnvWithFallback(
      "BOOK_REPORTS_PATH",
      process.env.NODE_ENV === "production" ? "" : "./book-reports",
      "Path to book reports directory (required in production)"
    );
    
    if (!bookReportsPath || bookReportsPath.trim() === "") {
      // Skip this directory if not set in production
      if (process.env.NODE_ENV === "production") {
        console.warn("[Report Bundle] BOOK_REPORTS_PATH not set, skipping book reports directory");
      }
    } else {
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

    if (searchDirs.length === 0) {
      return NextResponse.json({ 
        error: "No image search directories available",
        message: "Please ensure REPORT_STORAGE_PATH or BOOK_REPORTS_PATH is configured"
      }, { status: 400 });
    }

    // Bundle the HTML
    const bundledHtml = await bundleReportHtmlFromContent(report.htmlContent, searchDirs);

    // Update database with bundled HTML
    await db
      .update(reports)
      .set({ htmlContent: bundledHtml })
      .where(eq(reports.id, report.id));

    // Also save to file system
    try {
      await fs.mkdir(reportStoragePath, { recursive: true });
      const htmlFilePath = path.join(reportStoragePath, `${report.id}.html`);
      await fs.writeFile(htmlFilePath, bundledHtml, 'utf-8');
    } catch (error) {
      console.warn("Could not save bundled report to file system:", error);
    }

    return NextResponse.json({ 
      success: true,
      message: "Report bundled successfully",
      reportId: report.id
    });
  } catch (error) {
    console.error("Failed to bundle report:", error);
    return NextResponse.json(
      { error: "Failed to bundle report" },
      { status: 500 }
    );
  }
}

