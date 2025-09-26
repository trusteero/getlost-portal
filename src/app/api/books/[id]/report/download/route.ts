import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

// Function to sanitize filename
function sanitizeFilename(filename: string): string {
  // Remove or replace invalid characters
  let sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Limit length to 200 characters (leaving room for extension)
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200).trim();
  }

  // If empty after sanitization, use default
  if (!sanitized) {
    sanitized = 'report';
  }

  return sanitized;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
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
      .where(eq(reports.bookVersionId, latestVersion.id))
      .where(eq(reports.status, "completed"))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "No completed report found" }, { status: 404 });
    }

    // Try to read from file system
    const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
    const reportDir = path.resolve(reportStoragePath);

    // Try common file extensions
    const extensions = ['.pdf', '.html'];
    let fileBuffer: Buffer | null = null;
    let fileExt = '';
    let mimeType = 'application/octet-stream';

    for (const ext of extensions) {
      const filePath = path.join(reportDir, `${report.id}${ext}`);
      try {
        fileBuffer = await fs.readFile(filePath);
        fileExt = ext;
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
        fileExt = '.html';
        mimeType = 'text/html';
      } else {
        return NextResponse.json({ error: "Report file not found" }, { status: 404 });
      }
    }

    // Create filename from book title
    const baseFilename = sanitizeFilename(book.title);
    const fileName = `${baseFilename}-report${fileExt}`;

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    return new NextResponse(fileBuffer, {
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