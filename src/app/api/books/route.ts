import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, digestJobs, reports, bookFeatures } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { triggerBookDigest } from "@/server/services/bookdigest";
import { promises as fs } from "fs";
import path from "path";
import { findMatchingReport } from "@/server/utils/demo-reports";
import { bundleReportHtml } from "@/server/utils/bundle-report-html";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userBooks = await db
      .select({
        id: books.id,
        title: books.title,
        description: books.description,
        coverImageUrl: books.coverImageUrl,
        createdAt: books.createdAt,
      })
      .from(books)
      .where(eq(books.userId, session.user.id))
      .orderBy(desc(books.createdAt));

    // Get latest version, report, and digest status for each book
    const booksWithDetails = await Promise.all(
      userBooks.map(async (book: any) => {
        const latestVersion = await db
          .select()
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id))
          .orderBy(desc(bookVersions.uploadedAt))
          .limit(1);

        // Get digest job data
        const digestJob = await db
          .select({
            status: digestJobs.status,
            words: digestJobs.words,
            summary: digestJobs.summary,
            coverUrl: digestJobs.coverUrl,
          })
          .from(digestJobs)
          .where(eq(digestJobs.bookId, book.id))
          .orderBy(desc(digestJobs.createdAt))
          .limit(1);

        // Get latest report for the latest version
        let latestReport = null;
        if (latestVersion[0]) {
          const [report] = await db
            .select({
              id: reports.id,
              bookVersionId: reports.bookVersionId,
              status: reports.status,
              requestedAt: reports.requestedAt,
              completedAt: reports.completedAt,
            })
            .from(reports)
            .where(eq(reports.bookVersionId, latestVersion[0].id))
            .orderBy(desc(reports.requestedAt))
            .limit(1);

          if (report) {
            // Map database status to UI status for consistency
            const uiStatus = report.status === "pending" ? "requested" : report.status;
            latestReport = {
              ...report,
              status: uiStatus,
            };
          }
        }

        // Get feature statuses
        const features = await db
          .select()
          .from(bookFeatures)
          .where(eq(bookFeatures.bookId, book.id));

        return {
          ...book,
          latestVersion: latestVersion[0],
          latestReport,
          isProcessing: digestJob[0]?.status === "processing" || digestJob[0]?.status === "pending",
          digestJob: digestJob[0] || null,
          features: features,
        };
      })
    );

    return NextResponse.json(booksWithDetails);
  } catch (error) {
    console.error("Failed to fetch books:", error);
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string || "";
    const summary = formData.get("summary") as string || "";
    const file = formData.get("file") as File;
    const coverImage = formData.get("coverImage") as File | null;

    if (!title || !file) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate book ID first
    const bookId = crypto.randomUUID();

    // Handle cover image upload if provided
    let coverImageUrl: string | null = null;
    if (coverImage) {
      const coverStoragePath = process.env.COVER_STORAGE_PATH || './uploads/covers';
      const coverDir = path.resolve(coverStoragePath);

      // Create directory if it doesn't exist
      await fs.mkdir(coverDir, { recursive: true });

      // Get file extension from MIME type
      const ext = coverImage.type.split('/')[1] || 'jpg';
      const coverFileName = `${bookId}.${ext}`;
      const coverFilePath = path.join(coverDir, coverFileName);

      // Save cover image to disk
      const bytes = await coverImage.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(coverFilePath, buffer);

      // Store the path for serving
      coverImageUrl = `/api/covers/${bookId}.${ext}`;
    }

    // Create book with pre-generated ID
    const newBook = await db
      .insert(books)
      .values({
        id: bookId,
        userId: session.user.id,
        title,
        description,
        coverImageUrl,
      })
      .returning();

    const createdBook = newBook[0]!;

    // Save the book file to disk
    const bookStoragePath = process.env.BOOK_STORAGE_PATH || './uploads/books';
    const bookDir = path.resolve(bookStoragePath);

    // Create directory if it doesn't exist
    await fs.mkdir(bookDir, { recursive: true });

    // Save file with book ID as name (preserving extension for download)
    const fileExt = path.extname(file.name);
    const storedFileName = `${bookId}${fileExt}`;
    const bookFilePath = path.join(bookDir, storedFileName);

    // Save book file to disk
    const fileBytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    await fs.writeFile(bookFilePath, fileBuffer);

    // Also store file data in database for now (for backward compatibility)
    const fileBase64 = fileBuffer.toString('base64');

    // Create first version
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;
    const fileUrl = `/api/books/${bookId}/file`;

    const newVersion = await db
      .insert(bookVersions)
      .values({
        bookId: createdBook.id,
        versionNumber: 1,
        fileName,
        fileUrl,
        fileSize,
        fileType,
        fileData: fileBase64,
        mimeType: fileType,
        summary,
      })
      .returning();

    // Trigger BookDigest job asynchronously
    try {
      await triggerBookDigest(createdBook.id, fileBuffer, fileName);
      console.log(`BookDigest job triggered for book ${createdBook.id}`);
    } catch (error) {
      // Log error but don't fail the book creation
      console.error("Failed to trigger BookDigest job:", error);
    }

    // Demo mode: Check if there's a matching report (HTML or PDF) in book-reports folder
    try {
      const matchingReports = await findMatchingReport(fileName, title);
      
      if (matchingReports.htmlPath || matchingReports.pdfPath) {
        console.log(`[Demo] Found matching report for "${fileName}", linking it to book ${createdBook.id}`);
        
        // Save report to report storage
        const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
        const reportDir = path.resolve(reportStoragePath);
        await fs.mkdir(reportDir, { recursive: true });
        
        const reportId = crypto.randomUUID();
        let htmlContent: string | null = null;
        let pdfPath: string | null = null;
        
        // Prefer HTML over PDF
        if (matchingReports.htmlPath) {
          const htmlBuffer = await fs.readFile(matchingReports.htmlPath);
          let rawHtmlContent = htmlBuffer.toString('utf-8');
          
          // Bundle images into HTML as base64 data URLs
          htmlContent = await bundleReportHtml(matchingReports.htmlPath, rawHtmlContent);
          
          const htmlFileName = `${reportId}.html`;
          const htmlFilePath = path.join(reportDir, htmlFileName);
          // Save bundled HTML to file system
          await fs.writeFile(htmlFilePath, htmlContent, 'utf-8');
          console.log(`[Demo] Stored bundled HTML report for book ${createdBook.id}`);
        }
        
        // Also store PDF if available
        if (matchingReports.pdfPath) {
          const pdfBuffer = await fs.readFile(matchingReports.pdfPath);
          const pdfFileName = `${reportId}.pdf`;
          pdfPath = path.join(reportDir, pdfFileName);
          await fs.writeFile(pdfPath, pdfBuffer);
          console.log(`[Demo] Stored PDF report for book ${createdBook.id}`);
        }
        
        // Create completed report record (user still needs to purchase to view)
        await db.insert(reports).values({
          id: reportId,
          bookVersionId: newVersion[0]!.id,
          status: "completed",
          requestedAt: new Date(),
          completedAt: new Date(),
          htmlContent: htmlContent,
          pdfUrl: pdfPath ? `/api/books/${createdBook.id}/report/download` : undefined,
        });
        
        // Note: Feature is NOT auto-unlocked - user must purchase it
        console.log(`[Demo] Report linked for book ${createdBook.id} (user must purchase to view)`);
      }
    } catch (error) {
      // Log error but don't fail the book creation
      console.error("[Demo] Failed to link matching report:", error);
    }

    return NextResponse.json({
      bookId: createdBook.id,
      versionId: newVersion[0]!.id,
    });
  } catch (error) {
    console.error("Failed to create book:", error);
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }
}