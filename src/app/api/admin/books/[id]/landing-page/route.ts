import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, landingPages } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { storeUploadedAsset, findVideoFiles, rewriteVideoReferences } from "@/server/utils/store-uploaded-asset";
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
        console.log(`[Landing Page Upload] Extracted ZIP to: ${tempDir}`);
        
        // Find HTML file(s) in the extracted files
        const zipEntries = zip.getEntries();
        const htmlFiles = zipEntries
          .filter(entry => entry.entryName.toLowerCase().endsWith('.html') && !entry.isDirectory)
          .map(entry => entry.entryName);
        
        if (htmlFiles.length === 0) {
          return NextResponse.json({ error: "No HTML file found in ZIP archive" }, { status: 400 });
        }
        
        if (htmlFiles.length > 1) {
          console.warn(`[Landing Page Upload] Multiple HTML files found, using first: ${htmlFiles[0]}`);
        }
        
        // htmlFiles[0] is guaranteed to exist after length check
        htmlFileName = htmlFiles[0]!;
        const htmlFilePath = path.join(tempDir, htmlFileName);
        
        // Read HTML content
        rawHtmlContent = await fs.readFile(htmlFilePath, 'utf-8');
        
        // Track extracted files
        extractedFiles = zipEntries
          .filter(entry => !entry.isDirectory)
          .map(entry => entry.entryName);
        
        console.log(`[Landing Page Upload] Found HTML file: ${htmlFileName}`);
        console.log(`[Landing Page Upload] Extracted ${extractedFiles.length} file(s) from ZIP`);
      } else {
        // Handle standalone HTML file
        htmlFileName = file.name;
        const fileBytes = await file.arrayBuffer();
        rawHtmlContent = Buffer.from(fileBytes).toString('utf-8');
        console.log(`[Landing Page Upload] Processing standalone HTML file: ${htmlFileName}`);
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

      // Find and store video files if ZIP was uploaded
      const videoReplacements = new Map<string, string>();
      
      if (isZip) {
        // Find all video files in the extracted ZIP
        const videoFiles = await findVideoFiles(tempDir, tempDir);
        console.log(`[Landing Page Upload] Found ${videoFiles.length} video file(s) in ZIP`);
        
        // Store each video file and create URL mapping
        for (const videoFile of videoFiles) {
          try {
            const fileName = path.basename(videoFile.fullPath);
            const { fileUrl } = await storeUploadedAsset(
              videoFile.fullPath,
              id,
              "landing-page",
              fileName
            );
            
            // Map both relative path and filename for replacement
            videoReplacements.set(videoFile.relativePath, fileUrl);
            videoReplacements.set(fileName, fileUrl);
            
            console.log(`[Landing Page Upload] Stored video: ${videoFile.relativePath} -> ${fileUrl}`);
          } catch (error) {
            console.error(`[Landing Page Upload] Failed to store video ${videoFile.relativePath}:`, error);
            // Continue with other videos even if one fails
          }
        }
      }
      
      // Bundle images into HTML (videos are handled separately)
      let htmlContent = await bundleReportHtmlFromContent(rawHtmlContent, searchDirs);
      
      // Rewrite video references in HTML to use stored URLs
      if (videoReplacements.size > 0) {
        htmlContent = rewriteVideoReferences(htmlContent, videoReplacements);
        console.log(`[Landing Page Upload] Rewrote ${videoReplacements.size} video reference(s) in HTML`);
      }

    const landingPageId = randomUUID();

    // Check if there are any existing landing pages for this book
    const existingLandingPages = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.bookId, id))
      .limit(1);

    // Set as active if this is the first landing page
    const isActive = existingLandingPages.length === 0;

    // If setting as active, unset all other active landing pages
    if (isActive) {
      await db
        .update(landingPages)
        .set({ isActive: false })
        .where(eq(landingPages.bookId, id));
    }

    // Generate slug from book title
    const slug = book.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50) + `-${landingPageId.substring(0, 8)}`;

    // Insert into database
    await db.insert(landingPages).values({
      id: landingPageId,
      bookId: id,
      slug,
      title: book.title,
      headline: null,
      subheadline: null,
      description: null,
      htmlContent: htmlContent,
      customCss: null,
      metadata: JSON.stringify({
        originalFileName: file.name,
        uploadedAsZip: isZip,
        videoFilesCount: videoReplacements.size,
        uploadedAt: new Date().toISOString(),
      }),
      isPublished: false,
      isActive,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

      return NextResponse.json({
        success: true,
        landingPageId,
        slug,
        uploadedAsZip: isZip,
        extractedFilesCount: extractedFiles.length,
        videoFilesCount: videoReplacements.size,
      });
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[Landing Page Upload] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[Landing Page Upload] Failed to cleanup temp directory: ${cleanupError}`);
      }
    }
  } catch (error) {
    console.error("Failed to upload landing page:", error);
    return NextResponse.json(
      { error: "Failed to upload landing page" },
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
    const allLandingPages = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.bookId, id))
      .orderBy(landingPages.createdAt);

    return NextResponse.json(allLandingPages);
  } catch (error) {
    console.error("Failed to fetch landing pages:", error);
    return NextResponse.json(
      { error: "Failed to fetch landing pages" },
      { status: 500 }
    );
  }
}

