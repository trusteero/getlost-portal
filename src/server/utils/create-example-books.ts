import { db } from "@/server/db";
import { books, bookVersions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { importPrecannedContentForBook } from "./precanned-content";
import { ensureBooksTableColumns, columnExists } from "@/server/db/migrations";

/**
 * Creates two example books for a user with precanned content
 * Uses "wool" and "beach-read" from the precanned content
 * Only creates books if the user doesn't already have example books
 */
export async function createExampleBooksForUser(userId: string): Promise<void> {
  try {
    console.log(`[Example Books] Creating example books for user ${userId}`);

    // Check if user already has example books (check for "Wool" or "Beach Read" titles)
    const existingBooks = await db
      .select()
      .from(books)
      .where(eq(books.userId, userId))
      .limit(10);

    const hasExampleBooks = existingBooks.some(
      (book) =>
        book.title?.includes("Wool") || book.title?.includes("Beach Read")
    );

    if (hasExampleBooks) {
      console.log(`[Example Books] User ${userId} already has example books, skipping creation`);
      return;
    }

    // Ensure books table has required columns
    ensureBooksTableColumns();

    // The two example books to create
    const exampleBooks = [
      { key: "wool", title: "Wool by Hugh Howey" },
      { key: "beach-read", title: "Beach Read by Emily Henry" },
    ];

    for (const exampleBook of exampleBooks) {
      try {
        // Create book record
        const bookId = randomUUID();
        const insertValues: any = {
          id: bookId,
          userId,
          title: exampleBook.title,
          description: `Example book: ${exampleBook.title}`,
        };

        // Add optional columns if they exist
        if (columnExists("getlostportal_book", "manuscriptStatus")) {
          insertValues.manuscriptStatus = "ready_to_purchase"; // Reports will be imported, so ready to purchase
        }

        const newBook = await db
          .insert(books)
          .values(insertValues)
          .returning();

        const createdBook = newBook[0]!;
        console.log(`[Example Books] Created book: ${createdBook.id} - ${createdBook.title}`);

        // Create a book version (required for reports)
        const versionId = randomUUID();
        const versionValues: any = {
          id: versionId,
          bookId: createdBook.id,
          versionNumber: 1,
          fileName: `${exampleBook.key}.pdf`, // Example filename
          fileUrl: `/api/uploads/precanned/${exampleBook.key}.pdf`, // Placeholder URL
          fileSize: 1000000, // Placeholder size
          fileType: "application/pdf",
        };

        const newVersion = await db
          .insert(bookVersions)
          .values(versionValues)
          .returning();

        const createdVersion = newVersion[0]!;
        console.log(`[Example Books] Created version: ${createdVersion.id} for book ${createdBook.id}`);

        // Import precanned content (reports, marketing, covers, landing pages)
        const importResult = await importPrecannedContentForBook({
          bookId: createdBook.id,
          bookVersionId: createdVersion.id,
          precannedKey: exampleBook.key,
          features: {
            reports: true, // Import reports
            marketing: false, // Don't import marketing (coming soon)
            covers: false, // Don't import covers (coming soon)
            landingPage: false, // Don't import landing pages (coming soon)
          },
        });

        if (importResult) {
          console.log(`[Example Books] Imported precanned content for ${exampleBook.title}:`, {
            reportsLinked: importResult.reportsLinked,
            packageKey: importResult.packageKey,
          });
        } else {
          console.warn(`[Example Books] Failed to import precanned content for ${exampleBook.key}`);
        }
      } catch (error: any) {
        console.error(`[Example Books] Failed to create example book ${exampleBook.key}:`, error);
        // Continue with next book even if one fails
      }
    }

    console.log(`[Example Books] ✅ Finished creating example books for user ${userId}`);
  } catch (error: any) {
    console.error(`[Example Books] Error creating example books for user ${userId}:`, error);
    // Don't throw - we don't want to fail user creation if example books fail
  }
}

