import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports, bookVersions, books } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { findMatchingReport } from "@/server/utils/demo-reports";
import { bundleReportHtml } from "@/server/utils/bundle-report-html";
import { promises as fs } from "fs";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reports/[id]/fix-html
 * Fix a report that exists but has no HTML content
 * Finds matching HTML file, bundles images, and stores in database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id: reportId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get report with book and version info
    const report = await db
      .select({
        id: reports.id,
        status: reports.status,
        bookVersionId: reports.bookVersionId,
        fileName: bookVersions.fileName,
        bookId: bookVersions.bookId,
        bookTitle: books.title,
      })
      .from(reports)
      .innerJoin(bookVersions, eq(reports.bookVersionId, bookVersions.id))
      .innerJoin(books, eq(bookVersions.bookId, books.id))
      .where(eq(reports.id, reportId))
      .limit(1);

    if (report.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const reportData = report[0]!;

    if (reportData.status !== "completed") {
      return NextResponse.json(
        { error: `Report is not completed (status: ${reportData.status})` },
        { status: 400 }
      );
    }

    // Try to find matching HTML file
    const matchingReports = await findMatchingReport(
      reportData.fileName,
      reportData.bookTitle
    );

    if (!matchingReports.htmlPath) {
      return NextResponse.json(
        {
          error: "No matching HTML file found",
          debug: {
            fileName: reportData.fileName,
            bookTitle: reportData.bookTitle,
            bookReportsPath: process.env.BOOK_REPORTS_PATH || "not set",
          },
        },
        { status: 404 }
      );
    }

    // Read and bundle HTML
    const htmlBuffer = await fs.readFile(matchingReports.htmlPath);
    let htmlContent = htmlBuffer.toString("utf-8");

    // Bundle images into HTML
    htmlContent = await bundleReportHtml(
      matchingReports.htmlPath,
      htmlContent
    );

    // Update database
    await db
      .update(reports)
      .set({ htmlContent })
      .where(eq(reports.id, reportId));

    return NextResponse.json({
      success: true,
      message: "Report HTML content updated successfully",
      reportId,
    });
  } catch (error) {
    console.error("Failed to fix report HTML:", error);
    return NextResponse.json(
      { error: "Failed to fix report HTML" },
      { status: 500 }
    );
  }
}

