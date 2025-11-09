import { db } from "@/server/db";
import { reports, bookVersions, books } from "@/server/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Normalize a filename for comparison
 */
function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Find a seeded report by filename
 * Seeded reports are linked to system book and have filename in adminNotes
 */
export async function findSeededReportByFilename(
  fileName: string
): Promise<typeof reports.$inferSelect | null> {
  const normalizedFileName = normalizeFilename(fileName);
  
  // Find system book
  const systemBook = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
    .limit(1);
  
  if (systemBook.length === 0) {
    return null;
  }
  
  // Get system book versions
  const systemVersions = await db
    .select({ id: bookVersions.id })
    .from(bookVersions)
    .where(eq(bookVersions.bookId, systemBook[0]!.id));
  
  if (systemVersions.length === 0) {
    return null;
  }
  
  const systemVersionIds = systemVersions.map(v => v.id);
  
  // Find reports linked to system versions
  const seededReports = await db
    .select()
    .from(reports)
    .where(
      and(
        inArray(reports.bookVersionId, systemVersionIds),
        isNotNull(reports.adminNotes)
      )
    );
  
  // Check each report's adminNotes for filename match
  for (const report of seededReports) {
    try {
      if (report.adminNotes) {
        const notes = JSON.parse(report.adminNotes);
        if (notes.isSeeded && notes.seededFileName) {
          const seededNormalized = normalizeFilename(notes.seededFileName);
          // Match if filenames are similar (exact match or contains)
          if (seededNormalized === normalizedFileName ||
              seededNormalized.includes(normalizedFileName) ||
              normalizedFileName.includes(seededNormalized)) {
            return report;
          }
        }
      }
    } catch {
      // Invalid JSON in adminNotes, skip
      continue;
    }
  }
  
  return null;
}

/**
 * Link a seeded report to a book version
 * Copies the report data and links it to the new book version
 */
export async function linkSeededReportToBookVersion(
  seededReport: typeof reports.$inferSelect,
  bookVersionId: string
): Promise<string> {
  // Create a new report linked to the book version
  const newReportId = crypto.randomUUID();
  
  await db.insert(reports).values({
    id: newReportId,
    bookVersionId: bookVersionId,
    status: seededReport.status,
    htmlContent: seededReport.htmlContent,
    pdfUrl: seededReport.pdfUrl,
    adminNotes: seededReport.adminNotes,
    requestedAt: seededReport.requestedAt,
    completedAt: seededReport.completedAt,
    analyzedBy: seededReport.analyzedBy,
  });
  
  return newReportId;
}

