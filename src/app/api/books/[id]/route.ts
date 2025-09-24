import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get book details
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, params.id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check if user owns the book
    if (book[0].userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, params.id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get reports for each version
    const versionsWithReports = await Promise.all(
      versions.map(async (version) => {
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
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type");
    let title: string;
    let personalNotes: string;
    let coverImageUrl: string | undefined;

    if (contentType?.includes("multipart/form-data") || contentType?.includes("boundary=")) {
      const formData = await request.formData();
      title = formData.get("title") as string;
      personalNotes = formData.get("personalNotes") as string;

      const coverImage = formData.get("coverImage") as File | null;
      if (coverImage) {
        // Convert to base64 data URL for simplicity (in production, upload to S3 or similar)
        const bytes = await coverImage.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        const mimeType = coverImage.type;
        coverImageUrl = `data:${mimeType};base64,${base64}`;
      }
    } else {
      const body = await request.json();
      title = body.title;
      personalNotes = body.personalNotes;
    }

    // Verify book ownership
    const book = await db
      .select()
      .from(books)
      .where(and(
        eq(books.id, params.id),
        eq(books.userId, session.user.id)
      ))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Update book
    const updateData: any = {
      title: title || book[0].title,
      personalNotes: personalNotes,
      updatedAt: new Date(),
    };

    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    await db
      .update(books)
      .set(updateData)
      .where(eq(books.id, params.id));

    // Return updated book with all data
    const updatedBook = await db
      .select()
      .from(books)
      .where(eq(books.id, params.id))
      .limit(1);

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, params.id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get reports for each version
    const versionsWithReports = await Promise.all(
      versions.map(async (version) => {
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