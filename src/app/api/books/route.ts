import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, digestJobs, reports, bookFeatures } from "@/server/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { triggerBookDigest } from "@/server/services/bookdigest";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  importPrecannedContentForBook,
  findPrecannedCoverImageForFilename,
} from "@/server/utils/precanned-content";

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
      .where(
        and(
          eq(books.userId, session.user.id),
          ne(books.title, "SYSTEM_SEEDED_REPORTS") // Exclude system book
        )
      )
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
    const bookId = randomUUID();

    // Handle cover image upload if provided
    let coverImageUrl: string | null = null;
    if (coverImage) {
      // Use process.cwd() to ensure we resolve from project root
      const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
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

    // Attempt to import precanned content based on filename
    try {
      const precannedResult = await importPrecannedContentForBook({
        bookId: createdBook.id,
        bookVersionId: newVersion[0]!.id,
        fileName,
      });

      if (precannedResult) {
        console.log(
          `[Demo] Imported precanned package "${precannedResult.packageKey}" for book ${createdBook.id}`
        );

        // Only set precanned cover if no cover was uploaded
        if (precannedResult.primaryCoverImageUrl && !coverImageUrl) {
          await db
            .update(books)
            .set({ coverImageUrl: precannedResult.primaryCoverImageUrl, updatedAt: new Date() })
            .where(eq(books.id, createdBook.id));
          createdBook.coverImageUrl = precannedResult.primaryCoverImageUrl;
        }
      } else {
        console.log(`[Demo] No precanned content matched filename "${fileName}"`);
      }
    } catch (error) {
      console.error("[Demo] Failed to import precanned content:", error);
    }

    // Prefer a standalone cover image from precannedcontent/uploads when one
    // matches the uploaded filename (e.g. wool_cover.jpg, beach_read.jpg).
    // Only use this if no cover was uploaded and no precanned package cover was found.
    if (!coverImageUrl) {
      try {
        console.log(`[POST /api/books] Attempting to find precanned cover for filename: ${fileName}`);
        const uploadsCoverUrl = await findPrecannedCoverImageForFilename(fileName);
        if (uploadsCoverUrl) {
          await db
            .update(books)
            .set({ coverImageUrl: uploadsCoverUrl, updatedAt: new Date() })
            .where(eq(books.id, createdBook.id));
          createdBook.coverImageUrl = uploadsCoverUrl;
          console.log(
            `[Demo] ✅ Linked cover image from precanned uploads "${uploadsCoverUrl}" for book ${createdBook.id}`
          );
        } else {
          console.log(`[Demo] ⚠️  No precanned cover image found matching "${fileName}"`);
        }
      } catch (error) {
        console.error("[Demo] ❌ Failed to find cover image in precanned uploads:", error);
      }
    } else {
      console.log(`[POST /api/books] Skipping precanned cover lookup - cover already uploaded: ${coverImageUrl}`);
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