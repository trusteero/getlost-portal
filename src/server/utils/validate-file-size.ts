/**
 * File size validation utilities
 * Enforces server-side file size limits to prevent bypassing frontend checks
 */

// Maximum file size: 20MB (reduced for 512MB server memory constraint)
// With 512MB total memory, we need to be conservative:
// - Node.js base: ~50-100MB
// - Database: ~50-100MB
// - Application code: ~50-100MB
// - Leaves ~200-300MB for operations
// - 20MB per file allows ~10-15 concurrent uploads safely
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

/**
 * Validate file size
 * @param file - The file to validate
 * @param maxSize - Maximum allowed size in bytes (defaults to MAX_FILE_SIZE)
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateFileSize(
  file: File,
  maxSize: number = MAX_FILE_SIZE
): { isValid: boolean; error?: string } {
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { isValid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

