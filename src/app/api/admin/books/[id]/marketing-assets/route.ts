import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, marketingAssets } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
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

    if (!file || !title) {
      return NextResponse.json({ error: "ZIP file and title are required" }, { status: 400 });
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

    // Server-side file type validation for asset upload (ZIP or HTML)
    const { validateAssetOrHtmlFileType } = await import("@/server/utils/validate-file-type");
    const fileTypeValidation = validateAssetOrHtmlFileType(file);
    if (!fileTypeValidation.isValid) {
      return NextResponse.json(
        { error: fileTypeValidation.error },
        { status: 400 }
      );
    }

    // Determine file type for processing
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    const isHtml = file.name.endsWith('.html') && file.type === 'text/html';

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
        console.log(`[Marketing Assets] Extracted ZIP to: ${tempDir}`);
        
        // Find HTML file(s) in the extracted files
        const zipEntries = zip.getEntries();
        const htmlFiles = zipEntries
          .filter(entry => entry.entryName.toLowerCase().endsWith('.html') && !entry.isDirectory)
          .map(entry => entry.entryName);
        
        if (htmlFiles.length === 0) {
          return NextResponse.json({ error: "No HTML file found in ZIP archive" }, { status: 400 });
        }
        
        if (htmlFiles.length > 1) {
          console.warn(`[Marketing Assets] Multiple HTML files found, using first: ${htmlFiles[0]}`);
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
        
        console.log(`[Marketing Assets] Found HTML file: ${htmlFileName}`);
        console.log(`[Marketing Assets] Extracted ${extractedFiles.length} file(s) from ZIP`);
      } else {
        // Handle single HTML file (backward compatibility)
        htmlFileName = file.name;
        const fileBytes = await file.arrayBuffer();
        rawHtmlContent = Buffer.from(fileBytes).toString('utf-8');
        console.log(`[Marketing Assets] Processing single HTML file: ${htmlFileName}`);
      }

      // Build search directories for images
      const searchDirs: string[] = [];
      
      // 1. Temporary directory (extracted ZIP or uploaded files) - highest priority
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
          console.warn("[Marketing Assets] BOOK_REPORTS_PATH not set, skipping book reports directory");
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
        console.log(`[Marketing Assets] Found ${videoFiles.length} video file(s) in ZIP`);
        
        // Store each video file and create URL mapping
        for (const videoFile of videoFiles) {
          try {
            const fileName = path.basename(videoFile.fullPath);
            const { fileUrl } = await storeUploadedAsset(
              videoFile.fullPath,
              id,
              "marketing-assets",
              fileName
            );
            
            // Map both relative path and filename for replacement
            videoReplacements.set(videoFile.relativePath, fileUrl);
            videoReplacements.set(fileName, fileUrl);
            
            // Store the first video URL for the database fileUrl field
            if (!storedVideoUrl) {
              storedVideoUrl = fileUrl;
            }
            
            console.log(`[Marketing Assets] Stored video: ${videoFile.relativePath} -> ${fileUrl}`);
          } catch (error) {
            console.error(`[Marketing Assets] Failed to store video ${videoFile.relativePath}:`, error);
            // Continue with other videos even if one fails
          }
        }
      }
      
      // Bundle images into HTML (videos are handled separately)
      let htmlContent = await bundleReportHtmlFromContent(rawHtmlContent, searchDirs);
      
      // Rewrite video references in HTML to use stored URLs
      if (videoReplacements.size > 0) {
        htmlContent = rewriteVideoReferences(htmlContent, videoReplacements);
        console.log(`[Marketing Assets] Rewrote ${videoReplacements.size} video reference(s) in HTML`);
      }

    const assetId = randomUUID();

    // Check if there are any existing assets for this book
    const existingAssets = await db
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.bookId, id))
      .limit(1);

    // Set as active if this is the first asset
    const isActive = existingAssets.length === 0;

    // If setting as active, unset all other active assets
    if (isActive) {
      await db
        .update(marketingAssets)
        .set({ isActive: false })
        .where(eq(marketingAssets.bookId, id));
    }

    // Create metadata with HTML content
    const metadata = JSON.stringify({
      variant: "html",
      htmlContent: htmlContent,
      originalFileName: isZip ? htmlFileName : file.name,
      uploadedAsZip: isZip,
      extractedFilesCount: extractedFiles.length,
      videoFilesCount: videoReplacements.size,
      uploadedAt: new Date().toISOString(),
    });

    // Insert into database
    await db.insert(marketingAssets).values({
      id: assetId,
      bookId: id,
      assetType: "html",
      title: title,
      description: null,
      fileUrl: storedVideoUrl, // Store first video URL if videos were uploaded
      thumbnailUrl: null,
      metadata,
      isActive,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

      return NextResponse.json({
        success: true,
        assetId,
        title,
        uploadedAsZip: isZip,
        extractedFilesCount: extractedFiles.length,
        videoFilesCount: videoReplacements.size,
      });
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[Marketing Assets] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[Marketing Assets] Failed to cleanup temp directory: ${cleanupError}`);
      }
    }
  } catch (error) {
    console.error("Failed to upload marketing asset:", error);
    return NextResponse.json(
      { error: "Failed to upload marketing asset" },
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
    const allAssets = await db
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.bookId, id))
      .orderBy(marketingAssets.createdAt);

    return NextResponse.json(allAssets);
  } catch (error) {
    console.error("Failed to fetch marketing assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch marketing assets" },
      { status: 500 }
    );
  }
}

