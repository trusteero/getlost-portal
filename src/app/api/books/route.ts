import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, digestJobs } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { triggerBookDigest } from "@/server/services/bookdigest";

export async function GET(request: NextRequest) {
  const session = await auth();

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
      userBooks.map(async (book) => {
        const latestVersion = await db
          .select()
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id))
          .orderBy(desc(bookVersions.uploadedAt))
          .limit(1);

        // Get digest job status
        const digestJob = await db
          .select({
            status: digestJobs.status,
          })
          .from(digestJobs)
          .where(eq(digestJobs.bookId, book.id))
          .orderBy(desc(digestJobs.createdAt))
          .limit(1);

        // TODO: Add report fetching when reports API is ready

        return {
          ...book,
          latestVersion: latestVersion[0],
          latestReport: null, // TODO: fetch from reports
          isProcessing: digestJob[0]?.status === "processing" || digestJob[0]?.status === "pending",
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
  const session = await auth();

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

    // Handle cover image upload if provided
    let coverImageUrl: string | null = null;
    if (coverImage) {
      // Convert to base64 data URL for simplicity (in production, upload to S3 or similar)
      const bytes = await coverImage.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const mimeType = coverImage.type;
      coverImageUrl = `data:${mimeType};base64,${base64}`;
    }

    // Create book
    const newBook = await db
      .insert(books)
      .values({
        userId: session.user.id,
        title,
        description,
        coverImageUrl,
      })
      .returning();

    // Create first version
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    // TODO: Upload file to storage (S3, local, etc.)
    const fileUrl = `/uploads/${newBook[0].id}/v1/${fileName}`;

    const newVersion = await db
      .insert(bookVersions)
      .values({
        bookId: newBook[0].id,
        versionNumber: 1,
        fileName,
        fileUrl,
        fileSize,
        fileType,
        summary,
      })
      .returning();

    // Trigger BookDigest job asynchronously
    try {
      const fileBytes = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileBytes);
      await triggerBookDigest(newBook[0].id, fileBuffer, fileName);
      console.log(`BookDigest job triggered for book ${newBook[0].id}`);
    } catch (error) {
      // Log error but don't fail the book creation
      console.error("Failed to trigger BookDigest job:", error);
    }

    return NextResponse.json({
      bookId: newBook[0].id,
      versionId: newVersion[0].id,
    });
  } catch (error) {
    console.error("Failed to create book:", error);
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }
}