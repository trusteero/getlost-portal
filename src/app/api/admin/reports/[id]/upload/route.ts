import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { promises as fs } from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get session to get user email for analyzedBy field
  const { getSessionFromRequest } = await import("@/server/auth");
  const session = await getSessionFromRequest(request);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Check file type
    const fileType = file.type;
    const isHtml = fileType === "text/html" || file.name.endsWith(".html");
    const isPdf = fileType === "application/pdf" || file.name.endsWith(".pdf");

    if (!isHtml && !isPdf) {
      return NextResponse.json({ error: "File must be HTML or PDF" }, { status: 400 });
    }

    let htmlContent = null;
    let pdfUrl = null;

    if (isHtml) {
      // Read HTML content
      let rawHtmlContent = await file.text();
      
      // Bundle images into HTML as base64 data URLs
      const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
      const bookReportsPath = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";
      
      // Build search directories for images
      const searchDirs: string[] = [];
      
      // 1. Report storage directory
      try {
        await fs.access(reportStoragePath);
        searchDirs.push(reportStoragePath);
      } catch {
        // Directory doesn't exist, skip
      }
      
      // 2. Book reports directory
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
      
      // Bundle the HTML
      htmlContent = await bundleReportHtmlFromContent(rawHtmlContent, searchDirs);
      
      // Also save bundled HTML to file system
      const reportDir = path.resolve(reportStoragePath);
      await fs.mkdir(reportDir, { recursive: true });
      const htmlFilePath = path.join(reportDir, `${id}.html`);
      await fs.writeFile(htmlFilePath, htmlContent, 'utf-8');
      console.log(`[Admin Upload] Bundled and saved HTML report: ${htmlFilePath}`);
    } else if (isPdf) {
      // TODO: Upload PDF to storage and get URL
      pdfUrl = `/uploads/reports/${id}/${file.name}`;
    }

    // Update report
    await db
      .update(reports)
      .set({
        status: "completed",
        htmlContent,
        pdfUrl,
        completedAt: new Date(),
        analyzedBy: session.user.email,
      })
      .where(eq(reports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to upload report:", error);
    return NextResponse.json({ error: "Failed to upload report" }, { status: 500 });
  }
}