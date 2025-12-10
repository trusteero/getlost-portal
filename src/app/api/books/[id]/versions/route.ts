import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting for book version upload endpoint
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "books:version-upload",
    RATE_LIMITS.UPLOAD,
    session.user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if user owns the book
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const bookData = book[0]!;

    if (bookData.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
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

    // Get the latest version number
    const latestVersion = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.versionNumber))
      .limit(1);

    const nextVersionNumber = latestVersion.length > 0 ? latestVersion[0]!.versionNumber + 1 : 1;

    // TODO: Upload file to storage
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;
    const fileUrl = `/uploads/${id}/v${nextVersionNumber}/${fileName}`;

    // Create new version
    const newVersion = await db
      .insert(bookVersions)
      .values({
        bookId: id,
        versionNumber: nextVersionNumber,
        fileName,
        fileUrl,
        fileSize,
        fileType,
      })
      .returning();

    return NextResponse.json(newVersion[0]);
  } catch (error) {
    console.error("Failed to create book version:", error);
    return NextResponse.json({ error: "Failed to create book version" }, { status: 500 });
  }
}