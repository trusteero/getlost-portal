import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id: bookId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all versions for this book
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, bookId))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get all reports for all versions
    const allReports = [];
    for (const version of versions) {
      const versionReports = await db
        .select({
          id: reports.id,
          bookVersionId: reports.bookVersionId,
          status: reports.status,
          htmlContent: reports.htmlContent,
          pdfUrl: reports.pdfUrl,
          adminNotes: reports.adminNotes,
          requestedAt: reports.requestedAt,
          startedAt: reports.startedAt,
          completedAt: reports.completedAt,
          analyzedBy: reports.analyzedBy,
          viewedAt: reports.viewedAt,
        })
        .from(reports)
        .where(eq(reports.bookVersionId, version.id))
        .orderBy(desc(reports.requestedAt));
      
      allReports.push(...versionReports.map(r => ({
        ...r,
        versionNumber: version.versionNumber,
        fileName: version.fileName,
      })));
    }

    return NextResponse.json(allReports);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

