import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

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
    // Get book details
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const bookData = book[0]!;

    // Check if user owns the book or is admin
    const isAdmin = await isAdminFromRequest(request);
    if (bookData.userId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get reports for each version
    const versionsWithReports = await Promise.all(
      versions.map(async (version: any) => {
        const versionReports = await db
          .select({
            id: reports.id,
            status: reports.status,
            requestedAt: reports.requestedAt,
            completedAt: reports.completedAt,
            htmlContent: reports.htmlContent,
            pdfUrl: reports.pdfUrl,
          })
          .from(reports)
          .where(eq(reports.bookVersionId, version.id))
          .orderBy(desc(reports.requestedAt));

        return {
          ...version,
          reports: versionReports,
        };
      })
    );

    return NextResponse.json({
      ...book[0],
      versions: versionsWithReports,
    });
  } catch (error) {
    console.error("Failed to fetch book:", error);
    return NextResponse.json({ error: "Failed to fetch book" }, { status: 500 });
  }
}

// PATCH /api/books/[id] - Update book details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type");
    let title: string;
    let description: string;
    let coverImageUrl: string | undefined;

    if (contentType?.includes("multipart/form-data") || contentType?.includes("boundary=")) {
      const formData = await request.formData();
      title = formData.get("title") as string;
      description = formData.get("description") as string;

      const coverImage = formData.get("coverImage") as File | null;
      if (coverImage) {
        // Save cover image to file system (same as POST endpoint)
        const coverStoragePath = process.env.COVER_STORAGE_PATH || './uploads/covers';
        const coverDir = path.resolve(coverStoragePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(coverDir, { recursive: true });
        
        // Get file extension from MIME type
        const ext = coverImage.type.split('/')[1] || 'jpg';
        const coverFileName = `${id}.${ext}`;
        const coverFilePath = path.join(coverDir, coverFileName);
        
        // Save cover image to disk
        const bytes = await coverImage.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(coverFilePath, buffer);
        
        // Store the API path for serving
        coverImageUrl = `/api/covers/${id}.${ext}`;
      }
    } else {
      const body = await request.json();
      title = body.title;
      description = body.description;
    }

    // Verify book ownership
    const book = await db
      .select()
      .from(books)
      .where(and(
        eq(books.id, id),
        eq(books.userId, session.user.id)
      ))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const bookRecord = book[0]!;

    // Update book
    const updateData: any = {
      title: title || bookRecord.title,
      description: description,
      updatedAt: new Date(),
    };

    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    await db
      .update(books)
      .set(updateData)
      .where(eq(books.id, id));

    // Return updated book with all data
    const updatedBook = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get reports for each version
    const versionsWithReports = await Promise.all(
      versions.map(async (version: any) => {
        const versionReports = await db
          .select({
            id: reports.id,
            status: reports.status,
            requestedAt: reports.requestedAt,
            completedAt: reports.completedAt,
            htmlContent: reports.htmlContent,
            pdfUrl: reports.pdfUrl,
          })
          .from(reports)
          .where(eq(reports.bookVersionId, version.id))
          .orderBy(desc(reports.requestedAt));

        return {
          ...version,
          reports: versionReports,
        };
      })
    );

    return NextResponse.json({
      ...updatedBook[0],
      versions: versionsWithReports,
    });
  } catch (error) {
    console.error("Failed to update book:", error);
    return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
  }
}