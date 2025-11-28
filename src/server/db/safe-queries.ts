/**
 * Safe database query utilities
 * Handles missing columns gracefully by checking existence before querying
 */

import { db } from "./index";
import { books } from "./schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { columnExists } from "./migrations";

/**
 * Safely select book fields, only including columns that exist
 */
export async function safeSelectBooks(filters: {
  userId?: string;
  excludeSystemBooks?: boolean;
}) {
  // Ensure required columns exist first
  const { ensureBooksTableColumns } = await import("./migrations");
  ensureBooksTableColumns();

  // Build select object dynamically based on what columns exist
  const selectFields: any = {
    id: books.id,
    title: books.title,
    description: books.description,
    coverImageUrl: books.coverImageUrl,
    createdAt: books.createdAt,
  };

  // Only add optional columns if they exist
  if (columnExists("getlostportal_book", "authorName")) {
    selectFields.authorName = books.authorName;
  }
  if (columnExists("getlostportal_book", "authorBio")) {
    selectFields.authorBio = books.authorBio;
  }
  if (columnExists("getlostportal_book", "manuscriptStatus")) {
    selectFields.manuscriptStatus = books.manuscriptStatus;
  }

  // Build where clause
  const whereConditions = [];
  if (filters.userId) {
    whereConditions.push(eq(books.userId, filters.userId));
  }
  if (filters.excludeSystemBooks) {
    whereConditions.push(ne(books.title, "SYSTEM_SEEDED_REPORTS"));
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  try {
    return await db
      .select(selectFields)
      .from(books)
      .where(whereClause)
      .orderBy(desc(books.createdAt));
  } catch (error: any) {
    // If query fails due to missing columns, ensure columns exist and retry
    if (error.message?.includes("no such column")) {
      console.warn(
        "[Safe Queries] Query failed due to missing column, ensuring columns exist..."
      );
      ensureBooksTableColumns();

      // Retry with basic fields only
      const basicFields = {
        id: books.id,
        title: books.title,
        description: books.description,
        coverImageUrl: books.coverImageUrl,
        createdAt: books.createdAt,
      };

      const result = await db
        .select(basicFields)
        .from(books)
        .where(whereClause)
        .orderBy(desc(books.createdAt));

      // Add default values for missing columns
      return result.map((book: any) => ({
        ...book,
        authorName: null,
        authorBio: null,
        manuscriptStatus: "queued",
      }));
    }
    throw error;
  }
}

