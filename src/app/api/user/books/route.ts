import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { 
  books, 
  bookVersions, 
  reports, 
  digestJobs, 
  bookFeatures, 
  purchases,
  marketingAssets,
  bookCovers,
  landingPages,
  summaries,
  notifications
} from "@/server/db/schema";
import { eq, and, ne } from "drizzle-orm";

/**
 * DELETE /api/user/books
 * Delete all books and related data for the current user
 */
export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Get all books for this user, EXCLUDING the system book for seeded reports
    // The system book should be preserved for matching with new uploads
    const userBooks = await db
      .select({ id: books.id })
      .from(books)
      .where(
        and(
          eq(books.userId, userId),
          ne(books.title, "SYSTEM_SEEDED_REPORTS")
        )
      );

    const bookIds = userBooks.map(book => book.id);

    if (bookIds.length === 0) {
      return NextResponse.json({ 
        message: "No books found to delete",
        deleted: 0 
      });
    }

    // Delete in order to respect foreign key constraints
    // 1. Delete notifications related to books (if any)
    // Note: Notifications are user-specific, not book-specific, so we'll skip them
    
    // 2. Delete summaries
    for (const bookId of bookIds) {
      await db.delete(summaries).where(eq(summaries.bookId, bookId));
    }

    // 3. Delete landing pages
    for (const bookId of bookIds) {
      await db.delete(landingPages).where(eq(landingPages.bookId, bookId));
    }

    // 4. Delete book covers
    for (const bookId of bookIds) {
      await db.delete(bookCovers).where(eq(bookCovers.bookId, bookId));
    }

    // 5. Delete marketing assets
    for (const bookId of bookIds) {
      await db.delete(marketingAssets).where(eq(marketingAssets.bookId, bookId));
    }

    // 6. Delete purchases
    for (const bookId of bookIds) {
      await db.delete(purchases).where(eq(purchases.bookId, bookId));
    }

    // 7. Delete book features
    for (const bookId of bookIds) {
      await db.delete(bookFeatures).where(eq(bookFeatures.bookId, bookId));
    }

    // 8. Delete digest jobs
    for (const bookId of bookIds) {
      await db.delete(digestJobs).where(eq(digestJobs.bookId, bookId));
    }

    // 9. Delete reports (via book versions)
    // Get all book versions for all books
    const allBookVersions = await Promise.all(
      bookIds.map(bookId =>
        db.select({ id: bookVersions.id }).from(bookVersions).where(eq(bookVersions.bookId, bookId))
      )
    );
    
    const allVersionIds = allBookVersions.flat().map(v => v.id);
    
    for (const versionId of allVersionIds) {
      await db.delete(reports).where(eq(reports.bookVersionId, versionId));
    }

    // 10. Delete book versions
    for (const bookId of bookIds) {
      await db.delete(bookVersions).where(eq(bookVersions.bookId, bookId));
    }

    // 11. Finally, delete books
    const deleteResult = await db.delete(books).where(eq(books.userId, userId));

    return NextResponse.json({ 
      message: "All book data deleted successfully",
      deleted: bookIds.length 
    });
  } catch (error) {
    console.error("Failed to delete book data:", error);
    return NextResponse.json(
      { error: "Failed to delete book data" },
      { status: 500 }
    );
  }
}

