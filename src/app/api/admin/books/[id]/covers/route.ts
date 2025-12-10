import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookCovers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { storeUploadedAsset, findVideoFiles, rewriteVideoReferences } from "@/server/utils/store-uploaded-asset";
import { promises as fs } from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { getEnvWithFallback } from "@/server/utils/validate-env";

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

    // Server-side file size validation
    const { validateFileSize } = await import("@/server/utils/validate-file-size");
    const fileSizeValidation = validateFileSize(file);
    if (!fileSizeValidation.isValid) {
      return NextResponse.json(
        { error: fileSizeValidation.error },
        { status: 400 }
      );
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
        
        // htmlFiles[0] is guaranteed to exist after length check
        htmlFileName = htmlFiles[0]!;
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
      // In production, require BOOK_REPORTS_PATH to be set (no hardcoded fallback)
      const bookReportsPath = getEnvWithFallback(
        "BOOK_REPORTS_PATH",
        process.env.NODE_ENV === "production" ? "" : "./book-reports",
        "Path to book reports directory (required in production)"
      );
      
      if (!bookReportsPath || bookReportsPath.trim() === "") {
        // Skip this directory if not set in production
        if (process.env.NODE_ENV === "production") {
          console.warn("[Covers] BOOK_REPORTS_PATH not set, skipping book reports directory");
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

      // Find and store video files if ZIP was uploaded
      const videoReplacements = new Map<string, string>();
      let storedVideoUrl: string | null = null;
      
      if (isZip) {
        // Find all video files in the extracted ZIP
        const videoFiles = await findVideoFiles(tempDir, tempDir);
        console.log(`[Cover Upload] Found ${videoFiles.length} video file(s) in ZIP`);
        
        // Store each video file and create URL mapping
        for (const videoFile of videoFiles) {
          try {
            const fileName = path.basename(videoFile.fullPath);
            const { fileUrl } = await storeUploadedAsset(
              videoFile.fullPath,
              id,
              "covers",
              fileName
            );
            
            // Map both relative path and filename for replacement
            videoReplacements.set(videoFile.relativePath, fileUrl);
            videoReplacements.set(fileName, fileUrl);
            
            // Store the first video URL for the database imageUrl field
            if (!storedVideoUrl) {
              storedVideoUrl = fileUrl;
            }
            
            console.log(`[Cover Upload] Stored video: ${videoFile.relativePath} -> ${fileUrl}`);
          } catch (error) {
            console.error(`[Cover Upload] Failed to store video ${videoFile.relativePath}:`, error);
            // Continue with other videos even if one fails
          }
        }
      }
      
      // Bundle images into HTML (videos are handled separately)
      let htmlContent = await bundleReportHtmlFromContent(rawHtmlContent, searchDirs);
      
      // Rewrite video references in HTML to use stored URLs
      if (videoReplacements.size > 0) {
        htmlContent = rewriteVideoReferences(htmlContent, videoReplacements);
        console.log(`[Cover Upload] Rewrote ${videoReplacements.size} video reference(s) in HTML`);
      }

      // Try to extract first image URL from HTML for imageUrl field (required by database)
      let extractedImageUrl: string | null = null;
      if (htmlContent) {
        // Look for data:image URLs (embedded images)
        const dataImageMatch = htmlContent.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
        if (dataImageMatch && dataImageMatch[1]) {
          // For data URLs, we can't use them directly as imageUrl, so use placeholder
          extractedImageUrl = "/placeholder.svg";
        } else {
          // Look for regular image src URLs
          const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']/i);
          if (imgMatch && imgMatch[1]) {
            extractedImageUrl = imgMatch[1];
          }
        }
      }

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
      variant: "html", // Use "html" to match what the view routes expect
      htmlContent: htmlContent,
      originalFileName: file.name,
      uploadedAsZip: isZip,
      videoFilesCount: videoReplacements.size,
      uploadedAt: new Date().toISOString(),
    });

    // Insert into database
    // imageUrl is NOT NULL in database, so provide fallback
    // Priority: 1) First video URL, 2) Extracted image from HTML, 3) Placeholder
    const imageUrlToStore = storedVideoUrl || extractedImageUrl || "/placeholder.svg";
    
    await db.insert(bookCovers).values({
      id: coverId,
      bookId: id,
      coverType: "html-gallery",
      title: title || null,
      imageUrl: imageUrlToStore,
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
        videoFilesCount: videoReplacements.size,
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

