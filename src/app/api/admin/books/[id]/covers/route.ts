import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookCovers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
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

  try {
    // Verify book exists
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "ZIP or HTML file is required" }, { status: 400 });
    }

    // Validate it's a ZIP or HTML file
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    const isHtml = file.name.endsWith('.html') && file.type === 'text/html';
    
    if (!isZip && !isHtml) {
      return NextResponse.json({ error: "Only ZIP files (containing HTML + assets) or HTML files are allowed" }, { status: 400 });
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
        console.log(`[Cover Upload] Extracted ZIP to: ${tempDir}`);
        
        // Find HTML file(s) in the extracted files
        const zipEntries = zip.getEntries();
        const htmlFiles = zipEntries
          .filter(entry => entry.entryName.toLowerCase().endsWith('.html') && !entry.isDirectory)
          .map(entry => entry.entryName);
        
        if (htmlFiles.length === 0) {
          return NextResponse.json({ error: "No HTML file found in ZIP archive" }, { status: 400 });
        }
        
        if (htmlFiles.length > 1) {
          console.warn(`[Cover Upload] Multiple HTML files found, using first: ${htmlFiles[0]}`);
        }
        
        htmlFileName = htmlFiles[0];
        const htmlFilePath = path.join(tempDir, htmlFileName);
        
        // Read HTML content
        rawHtmlContent = await fs.readFile(htmlFilePath, 'utf-8');
        
        // Track extracted files
        extractedFiles = zipEntries
          .filter(entry => !entry.isDirectory)
          .map(entry => entry.entryName);
        
        console.log(`[Cover Upload] Found HTML file: ${htmlFileName}`);
        console.log(`[Cover Upload] Extracted ${extractedFiles.length} file(s) from ZIP`);
      } else {
        // Handle standalone HTML file
        htmlFileName = file.name;
        const fileBytes = await file.arrayBuffer();
        rawHtmlContent = Buffer.from(fileBytes).toString('utf-8');
        console.log(`[Cover Upload] Processing standalone HTML file: ${htmlFileName}`);
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

    const coverId = randomUUID();

    // Check if there are any existing covers for this book
    const existingCovers = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.bookId, id))
      .limit(1);

    // Set as primary if this is the first cover
    const isPrimary = existingCovers.length === 0;

    // If setting as primary, unset all other primary covers
    if (isPrimary) {
      await db
        .update(bookCovers)
        .set({ isPrimary: false })
        .where(eq(bookCovers.bookId, id));
    }

    // Create metadata with HTML content
    const metadata = JSON.stringify({
      variant: "html-gallery",
      htmlContent: htmlContent,
      originalFileName: file.name,
      uploadedAt: new Date().toISOString(),
    });

    // Insert into database
    await db.insert(bookCovers).values({
      id: coverId,
      bookId: id,
      coverType: "html-gallery",
      title: title || null,
      imageUrl: null, // No image URL needed, content is in metadata
      thumbnailUrl: null,
      metadata,
      isPrimary,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

      return NextResponse.json({
        success: true,
        coverId,
        title: title || "Cover Gallery",
        uploadedAsZip: isZip,
        extractedFilesCount: extractedFiles.length,
      });
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[Cover Upload] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[Cover Upload] Failed to cleanup temp directory: ${cleanupError}`);
      }
    }
  } catch (error) {
    console.error("Failed to upload cover:", error);
    return NextResponse.json(
      { error: "Failed to upload cover" },
      { status: 500 }
    );
  }
}

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
    const allCovers = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.bookId, id))
      .orderBy(bookCovers.createdAt);

    return NextResponse.json(allCovers);
  } catch (error) {
    console.error("Failed to fetch covers:", error);
    return NextResponse.json(
      { error: "Failed to fetch covers" },
      { status: 500 }
    );
  }
}

