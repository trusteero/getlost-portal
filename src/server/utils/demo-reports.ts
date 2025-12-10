import { promises as fs } from "fs";
import path from "path";
import { getEnvWithFallback } from "./validate-env";

// Get BOOK_REPORTS_PATH with fallback (required in production)
const BOOK_REPORTS_PATH = getEnvWithFallback(
  "BOOK_REPORTS_PATH",
  process.env.NODE_ENV === "production" ? "" : "./book-reports",
  "Path to book reports directory (required in production)"
);

// Validate that BOOK_REPORTS_PATH is set in production
if ((!BOOK_REPORTS_PATH || BOOK_REPORTS_PATH.trim() === "") && process.env.NODE_ENV === "production") {
  console.warn("[Demo Reports] BOOK_REPORTS_PATH not set in production. Demo reports functionality may be limited.");
}

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
 * Find a matching report (HTML or PDF) in the book-reports folder
 * Matches by:
 * 1. Exact filename match (case-insensitive, ignoring special chars)
 * 2. Folder name matching book title (normalized)
 * Returns both HTML and PDF paths if found
 */
export async function findMatchingReport(
  uploadedFileName: string,
  bookTitle?: string
): Promise<{ htmlPath: string | null; pdfPath: string | null }> {
  try {
    // Check if book-reports directory exists
    try {
      await fs.access(BOOK_REPORTS_PATH);
    } catch {
      console.log(`[Demo Reports] Book reports directory not found: ${BOOK_REPORTS_PATH}`);
      return { htmlPath: null, pdfPath: null };
    }

    const normalizedUploaded = normalizeFilename(uploadedFileName);
    const normalizedTitle = bookTitle ? normalizeFilename(bookTitle) : null;

    // Recursively find all report files (HTML and PDF)
    async function findReportFiles(dir: string): Promise<Array<{ path: string; name: string; folder: string; type: 'html' | 'pdf' }>> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: Array<{ path: string; name: string; folder: string; type: 'html' | 'pdf' }> = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await findReportFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.endsWith('.html') || lowerName.endsWith('.pdf')) {
            const folderName = path.basename(path.dirname(fullPath));
            files.push({
              path: fullPath,
              name: entry.name,
              folder: folderName,
              type: lowerName.endsWith('.html') ? 'html' : 'pdf',
            });
          }
        }
      }

      return files;
    }

    const allFiles = await findReportFiles(BOOK_REPORTS_PATH);
    let htmlPath: string | null = null;
    let pdfPath: string | null = null;

    // Try to find matches (prefer HTML files)
    for (const file of allFiles) {
      const normalizedFileName = normalizeFilename(file.name);
      const normalizedFolder = normalizeFilename(file.folder);

      // Check if this file matches
      const matchesFilename = normalizedFileName === normalizedUploaded ||
        normalizedFileName.includes(normalizedUploaded) ||
        normalizedUploaded.includes(normalizedFileName);
      
      const matchesFolder = normalizedTitle && normalizedFolder === normalizedTitle;

      if (matchesFilename || matchesFolder) {
        if (file.type === 'html' && !htmlPath) {
          htmlPath = file.path;
          console.log(`[Demo Reports] Found matching HTML by ${matchesFilename ? 'filename' : 'folder name'}: ${file.path}`);
        } else if (file.type === 'pdf' && !pdfPath) {
          pdfPath = file.path;
          console.log(`[Demo Reports] Found matching PDF by ${matchesFilename ? 'filename' : 'folder name'}: ${file.path}`);
        }
      }
    }

    if (!htmlPath && !pdfPath) {
      console.log(`[Demo Reports] No matching report found for "${uploadedFileName}"`);
    }

    return { htmlPath, pdfPath };
  } catch (error) {
    console.error("[Demo Reports] Error finding matching report:", error);
    return { htmlPath: null, pdfPath: null };
  }
}

