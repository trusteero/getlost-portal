import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

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
        personalNotes: books.personalNotes,
        createdAt: books.createdAt,
      })
      .from(books)
      .where(eq(books.userId, session.user.id))
      .orderBy(desc(books.createdAt));

    // Get latest version and report for each book
    const booksWithDetails = await Promise.all(
      userBooks.map(async (book) => {
        const latestVersion = await db
          .select()
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id))
          .orderBy(desc(bookVersions.uploadedAt))
          .limit(1);

        // TODO: Add report fetching when reports API is ready

        return {
          ...book,
          latestVersion: latestVersion[0],
          latestReport: null, // TODO: fetch from reports
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
    const personalNotes = formData.get("personalNotes") as string;
    const file = formData.get("file") as File;

    if (!title || !file) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create book
    const newBook = await db
      .insert(books)
      .values({
        userId: session.user.id,
        title,
        personalNotes,
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
      })
      .returning();

    return NextResponse.json({
      bookId: newBook[0].id,
      versionId: newVersion[0].id,
    });
  } catch (error) {
    console.error("Failed to create book:", error);
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }
}