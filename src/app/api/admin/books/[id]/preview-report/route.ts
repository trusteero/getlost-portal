import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { promises as fs } from "fs";
import path from "path";
import AdmZip from "adm-zip";

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get session to get user ID for analyzedBy field
  const { getSessionFromRequest } = await import("@/server/auth");
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "ZIP or HTML file is required" }, { status: 400 });
    }

    // Validate it's a ZIP or HTML file
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    const isHtml = file.name.endsWith('.html') && file.type === 'text/html';
    
    if (!isZip && !isHtml) {
      return NextResponse.json({ error: "Only ZIP files (containing HTML + assets) or HTML files are allowed" }, { status: 400 });
    }

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

    // Create temporary directory for extraction
    const tempDir = path.join(process.cwd(), 'tmp', `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      let rawHtmlContent: string;
      let htmlFileName: string;
      let extractedFiles: string[] = [];

      if (isZip) {
        // Handle ZIP file
        const fileBytes = await file.arrayBuffer();
        const zipBuffer = Buffer.from(fileBytes);
        
        const zip = new AdmZip(zipBuffer);
        
        // Extract ZIP to temporary directory
        zip.extractAllTo(tempDir, true);
        console.log(`[Preview Report Upload] Extracted ZIP to: ${tempDir}`);
        
        // Find HTML file(s) in the extracted files
        const zipEntries = zip.getEntries();
        const htmlFiles = zipEntries
          .filter(entry => entry.entryName.toLowerCase().endsWith('.html') && !entry.isDirectory)
          .map(entry => entry.entryName);
        
        if (htmlFiles.length === 0) {
          return NextResponse.json({ error: "No HTML file found in ZIP archive" }, { status: 400 });
        }
        
        if (htmlFiles.length > 1) {
          console.warn(`[Preview Report Upload] Multiple HTML files found, using first: ${htmlFiles[0]}`);
        }
        
        htmlFileName = htmlFiles[0];
        const htmlFilePath = path.join(tempDir, htmlFileName);
        
        // Read HTML content
        rawHtmlContent = await fs.readFile(htmlFilePath, 'utf-8');
        
        // Track extracted files
        extractedFiles = zipEntries
          .filter(entry => !entry.isDirectory)
          .map(entry => entry.entryName);
        
        console.log(`[Preview Report Upload] Found HTML file: ${htmlFileName}`);
        console.log(`[Preview Report Upload] Extracted ${extractedFiles.length} file(s) from ZIP`);
      } else {
        // Handle standalone HTML file
        htmlFileName = file.name;
        const fileBytes = await file.arrayBuffer();
        rawHtmlContent = Buffer.from(fileBytes).toString('utf-8');
        console.log(`[Preview Report Upload] Processing standalone HTML file: ${htmlFileName}`);
      }

      // Build search directories for images
      const searchDirs: string[] = [];
      
      // 1. Temporary directory (extracted ZIP) - highest priority if ZIP
      if (isZip) {
        searchDirs.push(tempDir);
        
        // Also add subdirectories of tempDir for nested structures
        try {
          const entries = await fs.readdir(tempDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              searchDirs.push(path.join(tempDir, entry.name));
            }
          }
        } catch {
          // Directory read failed, skip
        }
      }
      
      // 2. Book reports directory (common location for images)
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

      // Bundle images into HTML
      const htmlContent = await bundleReportHtmlFromContent(rawHtmlContent, searchDirs);

    // Generate report ID
    const reportId = randomUUID();

    // Create preview report
    await db
      .insert(reports)
      .values({
        id: reportId,
        bookVersionId: latestVersion.id,
        status: "preview",
        requestedAt: new Date(),
        completedAt: new Date(),
        analyzedBy: session.user.id,
        htmlContent: htmlContent,
      });

      return NextResponse.json({
        success: true,
        reportId,
        fileName: isZip ? htmlFileName : file.name,
        uploadedAsZip: isZip,
        extractedFilesCount: extractedFiles.length,
      });
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[Preview Report Upload] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[Preview Report Upload] Failed to cleanup temp directory: ${cleanupError}`);
      }
    }
  } catch (error) {
    console.error("Failed to upload preview report:", error);
    return NextResponse.json(
      { error: "Failed to upload preview report" },
      { status: 500 }
    );
  }
}

