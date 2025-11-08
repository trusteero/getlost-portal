import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get the latest version of the book
    const [latestVersion] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json({ error: "No book version found" }, { status: 404 });
    }

    // Get the latest report for this version
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "No report found" }, { status: 404 });
    }

    // Try to read from file system
    const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
    const reportDir = path.resolve(reportStoragePath);

    // Try common file extensions
    const extensions = ['.pdf', '.html'];
    let fileBuffer: Buffer | null = null;
    let fileName = `report_${id}`;
    let mimeType = 'application/octet-stream';

    for (const ext of extensions) {
      const filePath = path.join(reportDir, `${report.id}${ext}`);
      try {
        fileBuffer = await fs.readFile(filePath);
        fileName = `report_${id}${ext}`;
        mimeType = ext === '.pdf' ? 'application/pdf' : 'text/html';
        break;
      } catch (error) {
        // File with this extension doesn't exist, try next
      }
    }

    if (!fileBuffer) {
      // Check if report has HTML content in database (legacy)
      if (report.htmlContent) {
        fileBuffer = Buffer.from(report.htmlContent);
        fileName = `report_${id}.html`;
        mimeType = 'text/html';
      } else {
        return NextResponse.json({ error: "Report file not found" }, { status: 404 });
      }
    }

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Failed to download report:", error);
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 }
    );
  }
}