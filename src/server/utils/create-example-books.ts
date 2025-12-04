import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
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
            covers: false, // Use cover from report instead of separate import
            landingPage: false, // Don't import landing pages (coming soon)
          },
        });

        if (importResult) {
          console.log(`[Example Books] Imported precanned content for ${exampleBook.title}:`, {
            reportsLinked: importResult.reportsLinked,
            packageKey: importResult.packageKey,
          });
          
          // Extract cover image from the completed report's adminNotes
          if (importResult.reportsLinked > 0) {
            try {
              // Get the completed report for this book version
              const completedReports = await db
                .select({
                  adminNotes: reports.adminNotes,
                })
                .from(reports)
                .where(eq(reports.bookVersionId, createdVersion.id))
                .orderBy(desc(reports.requestedAt))
                .limit(5);
              
              // Look for cover image data in report adminNotes
              let coverImageUrl: string | null = null;
              for (const report of completedReports) {
                if (report.adminNotes) {
                  try {
                    const notes = JSON.parse(report.adminNotes);
                    if (notes.coverImageData && typeof notes.coverImageData === "string") {
                      // Use the cover image data URL from the report
                      coverImageUrl = notes.coverImageData;
                      console.log(`[Example Books] Found cover image in report for ${exampleBook.title}`);
                      break;
                    }
                  } catch (parseError) {
                    // Skip invalid JSON
                    continue;
                  }
                }
              }
              
              // Set the book's coverImageUrl from the report
              if (coverImageUrl) {
                await db
                  .update(books)
                  .set({
                    coverImageUrl: coverImageUrl,
                    updatedAt: new Date(),
                  })
                  .where(eq(books.id, createdBook.id));
                console.log(`[Example Books] Set cover image from report for ${exampleBook.title}`);
              } else {
                console.log(`[Example Books] No cover image found in report for ${exampleBook.title}`);
              }
            } catch (error: any) {
              console.error(`[Example Books] Error extracting cover from report for ${exampleBook.title}:`, error);
            }
          }
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

