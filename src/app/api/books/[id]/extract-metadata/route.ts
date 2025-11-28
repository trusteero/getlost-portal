import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { extractEpubMetadata } from "@/server/utils/extract-epub-metadata";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/books/[id]/extract-metadata
 * Extract metadata (title, cover, etc.) from a book file
 * 
 * This endpoint can be used to:
 * - Re-extract metadata for existing books
 * - Extract metadata for books that were uploaded before extraction was implemented
 * - Update book metadata when the source file changes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify book ownership
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the latest version to find the file
    const [latestVersion] = await db
      .select({
        id: bookVersions.id,
        fileName: bookVersions.fileName,
        fileData: bookVersions.fileData,
        mimeType: bookVersions.mimeType,
        fileType: bookVersions.fileType,
      })
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json(
        { error: "No file found for this book" },
        { status: 404 }
      );
    }

    // Read the book file
    let fileBuffer: Buffer;
    const fileExt = path.extname(latestVersion.fileName).toLowerCase();

    // Try to read from file system first
    const bookStoragePath = process.env.BOOK_STORAGE_PATH || './uploads/books';
    const bookDir = path.resolve(bookStoragePath);
    const storedFileName = `${id}${fileExt}`;
    const bookFilePath = path.join(bookDir, storedFileName);

    try {
      fileBuffer = await fs.readFile(bookFilePath);
      console.log(`[Extract Metadata] Read file from disk: ${bookFilePath}`);
    } catch (error) {
      // Fall back to database if file not found on disk
      if (latestVersion.fileData) {
        fileBuffer = Buffer.from(latestVersion.fileData, 'base64');
        console.log(`[Extract Metadata] Read file from database (${fileBuffer.length} bytes)`);
      } else {
        return NextResponse.json(
          { error: "Book file not found" },
          { status: 404 }
        );
      }
    }

    // Only extract metadata from EPUB files
    if (fileExt !== ".epub") {
      return NextResponse.json(
        {
          error: "Metadata extraction only supported for EPUB files",
          supportedFormats: [".epub"],
        },
        { status: 400 }
      );
    }

    // Extract metadata
    console.log(`[Extract Metadata] Extracting metadata from ${latestVersion.fileName}`);
    const metadata = await extractEpubMetadata(fileBuffer, latestVersion.fileName);

    const updates: {
      title?: string;
      coverImageUrl?: string;
      description?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    let hasUpdates = false;

    // Update title if extracted
    if (metadata.title && metadata.title.trim()) {
      updates.title = metadata.title.trim();
      hasUpdates = true;
      console.log(`[Extract Metadata] Extracted title: "${updates.title}"`);
    }

    // Update description if extracted and book doesn't have one
    if (metadata.description && metadata.description.trim() && !book.description) {
      updates.description = metadata.description.trim();
      hasUpdates = true;
      console.log(`[Extract Metadata] Extracted description`);
    }

    // Save cover image if extracted
    let coverUrl: string | null = null;
    if (metadata.coverImage) {
      const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
      const coverDir = path.resolve(coverStoragePath);
      await fs.mkdir(coverDir, { recursive: true });

      // Determine file extension from MIME type
      let ext = 'jpg'; // default
      if (metadata.coverImageMimeType) {
        const mimeParts = metadata.coverImageMimeType.split('/');
        if (mimeParts[1]) {
          ext = mimeParts[1];
          // Normalize jpeg to jpg
          if (ext === 'jpeg') ext = 'jpg';
        }
      }

      const coverFileName = `${id}.${ext}`;
      const coverFilePath = path.join(coverDir, coverFileName);

      // Save cover image to disk
      await fs.writeFile(coverFilePath, metadata.coverImage);

      // Store the path for serving
      coverUrl = `/api/covers/${id}.${ext}`;
      updates.coverImageUrl = coverUrl;
      hasUpdates = true;
      console.log(`[Extract Metadata] Extracted and saved cover image: ${coverUrl} (${metadata.coverImage.length} bytes)`);
    }

    // Update book record if we have any updates
    if (hasUpdates) {
      await db
        .update(books)
        .set(updates)
        .where(eq(books.id, id));

      console.log(`[Extract Metadata] Updated book ${id} with extracted metadata`);
    }

    // Return extracted metadata
    return NextResponse.json({
      success: true,
      extracted: {
        title: metadata.title || null,
        author: metadata.author || null,
        description: metadata.description || null,
        language: metadata.language || null,
        coverImage: metadata.coverImage ? {
          url: coverUrl,
          size: metadata.coverImage.length,
          mimeType: metadata.coverImageMimeType,
        } : null,
      },
      updated: hasUpdates,
      book: {
        id: book.id,
        title: updates.title || book.title,
        coverImageUrl: updates.coverImageUrl || book.coverImageUrl,
        description: updates.description || book.description,
      },
    });
  } catch (error) {
    console.error("[Extract Metadata] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract metadata",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/books/[id]/extract-metadata
 * Get extraction status/info for a book (without actually extracting)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify book ownership
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the latest version
    const [latestVersion] = await db
      .select({
        fileName: bookVersions.fileName,
        fileType: bookVersions.fileType,
      })
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json(
        { error: "No file found for this book" },
        { status: 404 }
      );
    }

    const fileExt = path.extname(latestVersion.fileName).toLowerCase();
    const isEpub = fileExt === ".epub";

    return NextResponse.json({
      canExtract: isEpub,
      fileType: fileExt,
      fileName: latestVersion.fileName,
      currentMetadata: {
        title: book.title,
        coverImageUrl: book.coverImageUrl,
        description: book.description,
      },
      supportedFormats: [".epub"],
    });
  } catch (error) {
    console.error("[Extract Metadata] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get extraction info",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

