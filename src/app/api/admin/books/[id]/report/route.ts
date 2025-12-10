import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest, getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { user as betterAuthUser } from "@/server/db/better-auth-schema";
import { promises as fs } from "fs";
import path from "path";
import { bundleReportHtmlFromContent } from "@/server/utils/bundle-report-html";
import { storeUploadedAsset, findVideoFiles, rewriteVideoReferences } from "@/server/utils/store-uploaded-asset";
import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";
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

  // Get session to get user ID for analyzedBy field and rate limiting
  const session = await getSessionFromRequest(request);

  // Rate limiting for admin upload endpoints
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "admin:upload-report",
    RATE_LIMITS.ADMIN,
    session?.user?.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

    // Validate file type - accept ZIP or HTML
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    const isHtml = file.name.endsWith('.html') && file.type === 'text/html';
    
    if (!isZip && !isHtml) {
      return NextResponse.json({ error: "Only ZIP files (containing HTML + assets) or standalone HTML files are allowed" }, { status: 400 });
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

    // Check if there's an existing report for this version
    let [existingReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    // Generate report ID
    const reportId = existingReport?.id || crypto.randomUUID();

    // Create temporary directory for ZIP extraction (if needed)
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
        console.log(`[Report Upload] Extracted ZIP to: ${tempDir}`);
        
        // Find HTML file(s) in the extracted files
        const zipEntries = zip.getEntries();
        const htmlFiles = zipEntries
          .filter(entry => entry.entryName.toLowerCase().endsWith('.html') && !entry.isDirectory)
          .map(entry => entry.entryName);
        
        if (htmlFiles.length === 0) {
          return NextResponse.json({ error: "No HTML file found in ZIP archive" }, { status: 400 });
        }
        
        if (htmlFiles.length > 1) {
          console.warn(`[Report Upload] Multiple HTML files found, using first: ${htmlFiles[0]}`);
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
        
        console.log(`[Report Upload] Found HTML file: ${htmlFileName}`);
        console.log(`[Report Upload] Extracted ${extractedFiles.length} file(s) from ZIP`);
      } else {
        // Handle standalone HTML file
        htmlFileName = file.name;
        const fileBytes = await file.arrayBuffer();
        rawHtmlContent = Buffer.from(fileBytes).toString('utf-8');
        console.log(`[Report Upload] Processing standalone HTML file: ${htmlFileName}`);
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
      
      // 2. Report storage directory (for standalone HTML)
      const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
      const reportDir = path.resolve(reportStoragePath);
      try {
        await fs.mkdir(reportDir, { recursive: true });
        if (!isZip) {
          searchDirs.push(reportDir);
        }
      } catch {
        // Directory doesn't exist, skip
      }
      
      // 3. Book reports directory
      // In production, require BOOK_REPORTS_PATH to be set (no hardcoded fallback)
      const bookReportsPath = getEnvWithFallback(
        "BOOK_REPORTS_PATH",
        process.env.NODE_ENV === "production" ? "" : "./book-reports",
        "Path to book reports directory (required in production)"
      );
      
      if (!bookReportsPath || bookReportsPath.trim() === "") {
        return NextResponse.json(
          { error: "BOOK_REPORTS_PATH environment variable is required" },
          { status: 500 }
        );
      }
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
        console.log(`[Report Upload] Found ${videoFiles.length} video file(s) in ZIP`);
        
        // Store each video file and create URL mapping
        for (const videoFile of videoFiles) {
          try {
            const fileName = path.basename(videoFile.fullPath);
            const { fileUrl } = await storeUploadedAsset(
              videoFile.fullPath,
              id,
              "report",
              fileName
            );
            
            // Map both relative path and filename for replacement
            videoReplacements.set(videoFile.relativePath, fileUrl);
            videoReplacements.set(fileName, fileUrl);
            
            console.log(`[Report Upload] Stored video: ${videoFile.relativePath} -> ${fileUrl}`);
          } catch (error) {
            console.error(`[Report Upload] Failed to store video ${videoFile.relativePath}:`, error);
            // Continue with other videos even if one fails
          }
        }
      }
      
      // Bundle images into HTML (videos are handled separately)
      let htmlContent = await bundleReportHtmlFromContent(rawHtmlContent, searchDirs);
      
      // Rewrite video references in HTML to use stored URLs
      if (videoReplacements.size > 0) {
        htmlContent = rewriteVideoReferences(htmlContent, videoReplacements);
        console.log(`[Report Upload] Rewrote ${videoReplacements.size} video reference(s) in HTML`);
      }
      
      // Save bundled HTML to disk (always save as .html)
      const storedFileName = `${reportId}.html`;
      const reportFilePath = path.join(reportDir, storedFileName);
      await fs.writeFile(reportFilePath, htmlContent, 'utf-8');
      console.log(`[Report Upload] Saved bundled HTML report: ${reportFilePath}`);

      // If no existing report, create one
      if (!existingReport) {
        await db
          .insert(reports)
          .values({
            id: reportId,
            bookVersionId: latestVersion.id,
            status: "completed",
            requestedAt: new Date(),
            completedAt: new Date(),
            analyzedBy: session.user.id,
            htmlContent: htmlContent, // Store bundled HTML (standalone with embedded images)
          });
      } else {
        // Update existing report
        await db
          .update(reports)
          .set({
            status: "completed",
            completedAt: new Date(),
            analyzedBy: session.user.id,
            htmlContent: htmlContent, // Update HTML (standalone with embedded images)
          })
          .where(eq(reports.id, existingReport.id));
      }

      // Get book details before updating status
      const [book] = await db
        .select()
        .from(books)
        .where(eq(books.id, id))
        .limit(1);

      if (!book) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }

      // Update manuscript status to "ready_to_purchase"
      await db
        .update(books)
        .set({
          manuscriptStatus: "ready_to_purchase",
          updatedAt: new Date(),
        })
        .where(eq(books.id, id));

      // Send notification email when report is uploaded
      try {
        const { sendReportReadyEmail } = await import("@/server/services/email");
        const betterAuthSchema = await import("@/server/db/better-auth-schema");
        const betterAuthUser = betterAuthSchema.user;
        const [userData] = await db
          .select({ email: betterAuthUser.email, name: betterAuthUser.name })
          .from(betterAuthUser)
          .where(eq(betterAuthUser.id, book.userId))
          .limit(1);
        
        if (userData?.email) {
          await sendReportReadyEmail(
            userData.email,
            book.title || "Untitled",
            id,
            userData.name || undefined
          );
          console.log(`[Email] Sent report ready notification to ${userData.email}`);
        }
      } catch (error) {
        // Don't fail report upload if email fails
        console.error("[Email] Failed to send report ready notification:", error);
      }

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
        console.log(`[Report Upload] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[Report Upload] Failed to cleanup temp directory: ${cleanupError}`);
      }
    }
  } catch (error) {
    console.error("Failed to upload report:", error);
    return NextResponse.json(
      { error: "Failed to upload report" },
      { status: 500 }
    );
  }
}