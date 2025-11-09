import { promises as fs } from "fs";
import path from "path";

const BOOK_REPORTS_PATH = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";

/**
 * Normalize a filename for comparison (lowercase, remove spaces, special chars)
 */
function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Find a matching PDF report in the book-reports folder
 * Matches by:
 * 1. Exact filename match (case-insensitive, ignoring special chars)
 * 2. Folder name matching book title (normalized)
 */
export async function findMatchingReport(
  uploadedFileName: string,
  bookTitle?: string
): Promise<string | null> {
  try {
    // Check if book-reports directory exists
    try {
      await fs.access(BOOK_REPORTS_PATH);
    } catch {
      console.log(`[Demo Reports] Book reports directory not found: ${BOOK_REPORTS_PATH}`);
      return null;
    }

    const normalizedUploaded = normalizeFilename(uploadedFileName);
    const normalizedTitle = bookTitle ? normalizeFilename(bookTitle) : null;

    // Recursively find all PDF files
    async function findPDFs(dir: string): Promise<Array<{ path: string; name: string; folder: string }>> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const pdfs: Array<{ path: string; name: string; folder: string }> = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subPdfs = await findPDFs(fullPath);
          pdfs.push(...subPdfs);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
          const folderName = path.basename(path.dirname(fullPath));
          pdfs.push({
            path: fullPath,
            name: entry.name,
            folder: folderName,
          });
        }
      }

      return pdfs;
    }

    const allPDFs = await findPDFs(BOOK_REPORTS_PATH);

    // Try to find a match
    for (const pdf of allPDFs) {
      const normalizedPdfName = normalizeFilename(pdf.name);
      const normalizedFolder = normalizeFilename(pdf.folder);

      // Match 1: Filename matches uploaded file
      if (normalizedPdfName === normalizedUploaded) {
        console.log(`[Demo Reports] Found matching PDF by filename: ${pdf.path}`);
        return pdf.path;
      }

      // Match 2: Folder name matches book title (if provided)
      if (normalizedTitle && normalizedFolder === normalizedTitle) {
        console.log(`[Demo Reports] Found matching PDF by folder name: ${pdf.path}`);
        return pdf.path;
      }

      // Match 3: Partial match - uploaded filename contains PDF name or vice versa
      if (
        normalizedPdfName.includes(normalizedUploaded) ||
        normalizedUploaded.includes(normalizedPdfName)
      ) {
        console.log(`[Demo Reports] Found matching PDF by partial match: ${pdf.path}`);
        return pdf.path;
      }
    }

    console.log(`[Demo Reports] No matching PDF found for "${uploadedFileName}"`);
    return null;
  } catch (error) {
    console.error("[Demo Reports] Error finding matching report:", error);
    return null;
  }
}

