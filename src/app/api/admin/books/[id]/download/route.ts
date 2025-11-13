import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

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
    // Get the book
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the latest version
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
      return NextResponse.json({ error: "No file found for this book" }, { status: 404 });
    }

    let fileBuffer: Buffer;

    // Try to read from file system first
    const bookStoragePath = process.env.BOOK_STORAGE_PATH || './uploads/books';
    const bookDir = path.resolve(bookStoragePath);
    const fileExt = path.extname(latestVersion.fileName);
    const storedFileName = `${id}${fileExt}`;
    const bookFilePath = path.join(bookDir, storedFileName);

    try {
      // Try to read from file system
      fileBuffer = await fs.readFile(bookFilePath);
    } catch (error) {
      // Fall back to database if file not found on disk
      if (latestVersion.fileData) {
        fileBuffer = Buffer.from(latestVersion.fileData, 'base64');
      } else {
        return NextResponse.json({ error: "Book file not found" }, { status: 404 });
      }
    }

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', latestVersion.mimeType || latestVersion.fileType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${latestVersion.fileName}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Failed to download book:", error);
    return NextResponse.json(
      { error: "Failed to download book" },
      { status: 500 }
    );
  }
}