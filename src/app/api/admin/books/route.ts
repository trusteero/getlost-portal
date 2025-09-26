import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, users, digestJobs } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  const isAdmin = session.user.role === "admin" || adminEmails.includes(session.user.email || "");

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all books with user info and digest status
    const allBooks = await db
      .select({
        id: books.id,
        title: books.title,
        description: books.description,
        coverImageUrl: books.coverImageUrl,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(books)
      .leftJoin(users, eq(books.userId, users.id))
      .orderBy(desc(books.createdAt));

    // Get digest status for each book
    const booksWithDigest = await Promise.all(
      allBooks.map(async (book) => {
        // Get latest digest job
        const [latestDigest] = await db
          .select({
            id: digestJobs.id,
            status: digestJobs.status,
            createdAt: digestJobs.createdAt,
            startedAt: digestJobs.startedAt,
            completedAt: digestJobs.completedAt,
            attempts: digestJobs.attempts,
            error: digestJobs.error,
            brief: digestJobs.brief,
            summary: digestJobs.summary,
            title: digestJobs.title,
            author: digestJobs.author,
            pages: digestJobs.pages,
            words: digestJobs.words,
            language: digestJobs.language,
          })
          .from(digestJobs)
          .where(eq(digestJobs.bookId, book.id))
          .orderBy(desc(digestJobs.createdAt))
          .limit(1);

        // Get latest version info
        const [latestVersion] = await db
          .select({
            id: bookVersions.id,
            fileName: bookVersions.fileName,
            fileSize: bookVersions.fileSize,
            uploadedAt: bookVersions.uploadedAt,
          })
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id))
          .orderBy(desc(bookVersions.uploadedAt))
          .limit(1);

        return {
          ...book,
          digestJob: latestDigest || null,
          latestVersion: latestVersion || null,
        };
      })
    );

    return NextResponse.json(booksWithDigest);
  } catch (error) {
    console.error("Failed to fetch admin books:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}