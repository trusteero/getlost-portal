import { promises as fs } from "fs";
import path from "path";

/**
 * Store an uploaded asset file (video, image, etc.) and return its API URL
 * Similar to copyPrecannedAsset but for admin-uploaded files
 * 
 * @param sourcePath - Full path to the source file
 * @param bookId - Book ID
 * @param assetType - Type of asset (marketing-assets, covers, landing-page, report)
 * @param fileName - Desired filename for the stored file
 * @returns Object with fileUrl (API path) and destinationPath
 */
export async function storeUploadedAsset(
  sourcePath: string,
  bookId: string,
  assetType: string,
  fileName: string
): Promise<{ fileUrl: string; destinationPath: string }> {
  // Use public/uploads/admin/{bookId}/{assetType}/videos/ structure
  // This mirrors the precanned structure but for admin uploads
  const publicRoot = path.resolve(process.cwd(), "public", "uploads", "admin");
  const destSegments = [bookId, assetType, "videos", fileName];
  const destinationDir = path.join(publicRoot, ...destSegments.slice(0, -1));
  
  await fs.mkdir(destinationDir, { recursive: true });
  
  const destinationPath = path.join(destinationDir, fileName);
  
  // Copy the file
  await fs.copyFile(sourcePath, destinationPath);
  console.log(`[storeUploadedAsset] ✅ Copied file to ${destinationPath}`);
  
  // Return API URL - we'll create an API route to serve these
  // Using /api/uploads/admin/... to match the structure
  const apiPath = "/api/uploads/admin/" + destSegments.map((segment) => segment.replace(/\\/g, "/")).join("/");
  
  console.log(`[storeUploadedAsset] API URL: ${apiPath}`);
  return { fileUrl: apiPath, destinationPath };
}

/**
 * Find all video files in a directory (recursively)
 * @param dirPath - Directory to search
 * @param baseDir - Base directory for relative paths
 * @returns Array of { relativePath, fullPath } for each video file
 */
export async function findVideoFiles(
  dirPath: string,
  baseDir: string = dirPath
): Promise<Array<{ relativePath: string; fullPath: string }>> {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
  const videoFiles: Array<{ relativePath: string; fullPath: string }> = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subVideos = await findVideoFiles(fullPath, baseDir);
        videoFiles.push(...subVideos);
      } else {
        // Check if it's a video file
        const ext = path.extname(entry.name).toLowerCase();
        if (videoExtensions.includes(ext)) {
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          videoFiles.push({ relativePath, fullPath });
        }
      }
    }
  } catch (error) {
    console.error(`[findVideoFiles] Error reading directory ${dirPath}:`, error);
  }
  
  return videoFiles;
}

/**
 * Rewrite video references in HTML to use new API URLs
 * @param html - HTML content
 * @param replacements - Map of old paths to new API URLs
 * @returns Updated HTML content
 */
export function rewriteVideoReferences(
  html: string,
  replacements: Map<string, string>
): string {
  let updatedHtml = html;
  
  // Replace video src attributes
  for (const [oldPath, newUrl] of replacements.entries()) {
    // Escape special regex characters
    const escapedPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match various patterns:
    // <video src="path/to/video.mp4">
    // <video src='path/to/video.mp4'>
    // <source src="path/to/video.mp4">
    const patterns = [
      new RegExp(`(<video[^>]*\\ssrc=["'])${escapedPath}(["'][^>]*>)`, 'gi'),
      new RegExp(`(<source[^>]*\\ssrc=["'])${escapedPath}(["'][^>]*>)`, 'gi'),
      new RegExp(`(src=["'])${escapedPath}(["'])`, 'gi'), // Generic src
    ];
    
    for (const pattern of patterns) {
      updatedHtml = updatedHtml.replace(pattern, (match, prefix, suffix) => {
        return prefix + newUrl + suffix;
      });
    }
  }
  
  return updatedHtml;
}

