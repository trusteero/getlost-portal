import { db } from "@/server/db";
import { reports, bookVersions, books } from "@/server/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Normalize a filename for comparison
 * Removes common suffixes and extensions to extract core book name
 */
function normalizeFilename(filename: string): string {
  // Remove file extension
  let normalized = filename.toLowerCase().replace(/\.[^.]*$/, '');
  
  // Remove common suffixes that might differ between PDF and HTML files
  normalized = normalized
    .replace(/\s*(final|book|report|manuscript|draft|version)\s*/g, '')
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
  
  return normalized;
}

/**
 * Extract core book name from filename
 * Removes common words and extracts the meaningful part
 */
function extractCoreName(filename: string): string {
  const normalized = normalizeFilename(filename);
  
  // Try to extract meaningful words (at least 3 characters)
  // This helps match "everlasting-gift" with "theeverlastinggiftbook"
  const words = normalized.match(/[a-z]{3,}/g) || [];
  
  // Return the longest meaningful substring
  // For "theeverlastinggiftbook" -> "everlastinggift"
  // For "everlastinggiftfinal" -> "everlastinggift"
  if (words.length > 0) {
    // Find the longest word (likely the book name)
    const longestWord = words.reduce((a, b) => a.length > b.length ? a : b);
    return longestWord;
  }
  
  return normalized;
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
          const uploadedNormalized = normalizeFilename(fileName);
          
          // Extract core names for better matching
          const seededCore = extractCoreName(notes.seededFileName);
          const uploadedCore = extractCoreName(fileName);
          
          // Match if:
          // 1. Normalized filenames match exactly or contain each other
          // 2. Core names match (handles "everlasting-gift" vs "theeverlastinggiftbook")
          if (seededNormalized === uploadedNormalized ||
              seededNormalized.includes(uploadedNormalized) ||
              uploadedNormalized.includes(seededNormalized) ||
              seededCore === uploadedCore ||
              seededCore.includes(uploadedCore) ||
              uploadedCore.includes(seededCore)) {
            console.log(`[Find Seeded Report] Matched "${fileName}" with seeded report "${notes.seededFileName}"`);
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
  const newReportId = randomUUID();
  
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

