import { promises as fs } from "fs";
import path from "path";

/**
 * Bundle report HTML with embedded images as base64 data URLs
 * This creates a self-contained HTML file that works anywhere
 * 
 * @param htmlFilePath - Path to the HTML file (for determining image base directory)
 * @param htmlContent - The HTML content to bundle
 * @param baseDir - Optional base directory to search for images (defaults to HTML file's directory)
 */
export async function bundleReportHtml(
  htmlFilePath: string,
  htmlContent: string,
  baseDir?: string
): Promise<string> {
  try {
    const reportDir = baseDir || path.dirname(htmlFilePath);
    
    // Find all image references in the HTML
    // Match: src="path/to/image.jpg", src='path/to/image.png', background-image: url(path/to/image.jpg), etc.
    const imageRegex = /(src|href|background-image:\s*url)\(?["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)?/gi;
    const matches = Array.from(htmlContent.matchAll(imageRegex));
    
    let bundledHtml = htmlContent;
    const processedImages = new Set<string>();
    
    for (const match of matches) {
      const imagePath = match[2];
      
      // Skip if imagePath is undefined or already processed or if it's an absolute URL or data URL
      if (!imagePath || processedImages.has(imagePath) || imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
        continue;
      }
      
      try {
        // Resolve image path relative to the base directory
        const resolvedImagePath = path.resolve(reportDir, imagePath);
        
        // Security check: ensure the image is within the base directory
        const reportDirResolved = path.resolve(reportDir);
        if (!resolvedImagePath.startsWith(reportDirResolved)) {
          console.warn(`[Bundle Report] Skipping image outside report directory: ${imagePath}`);
          continue;
        }
        
        // Check if file exists
        try {
          await fs.access(resolvedImagePath);
        } catch {
          console.warn(`[Bundle Report] Image not found: ${resolvedImagePath}`);
          continue;
        }
        
        // Read image file
        const imageBuffer = await fs.readFile(resolvedImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        
        // Determine MIME type from extension
        const ext = path.extname(resolvedImagePath).toLowerCase();
        let mimeType = 'image/jpeg';
        
        switch (ext) {
          case '.png':
            mimeType = 'image/png';
            break;
          case '.gif':
            mimeType = 'image/gif';
            break;
          case '.webp':
            mimeType = 'image/webp';
            break;
          case '.svg':
            mimeType = 'image/svg+xml';
            break;
          case '.jpg':
          case '.jpeg':
          default:
            mimeType = 'image/jpeg';
        }
        
        // Create data URL
        const dataUrl = `data:${mimeType};base64,${imageBase64}`;
        
        // Replace all occurrences of this image path in the HTML
        // Handle different quote styles and contexts
        const escapedPath = escapeRegex(imagePath);
        const patterns = [
          new RegExp(`src=["']${escapedPath}["']`, 'gi'),
          new RegExp(`href=["']${escapedPath}["']`, 'gi'),
          new RegExp(`background-image:\\s*url\\(["']?${escapedPath}["']?\\)`, 'gi'),
          new RegExp(`url\\(["']?${escapedPath}["']?\\)`, 'gi'),
        ];
        
        for (const pattern of patterns) {
          bundledHtml = bundledHtml.replace(pattern, (match) => {
            // Preserve the attribute name and replace the path
            if (match.includes('src=')) {
              return match.replace(imagePath, dataUrl);
            } else if (match.includes('href=')) {
              return match.replace(imagePath, dataUrl);
            } else if (match.includes('background-image')) {
              return match.replace(imagePath, dataUrl);
            } else if (match.includes('url(')) {
              return match.replace(imagePath, dataUrl);
            }
            return match;
          });
        }
        
        processedImages.add(imagePath);
        console.log(`[Bundle Report] Embedded image: ${imagePath} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
      } catch (error) {
        console.error(`[Bundle Report] Failed to embed image ${imagePath}:`, error);
        // Continue processing other images
      }
    }
    
    console.log(`[Bundle Report] Bundled ${processedImages.size} image(s) into HTML`);
    return bundledHtml;
  } catch (error) {
    console.error("[Bundle Report] Error bundling HTML:", error);
    // Return original HTML if bundling fails
    return htmlContent;
  }
}

/**
 * Bundle HTML content from database, searching for images in multiple locations
 * 
 * @param htmlContent - The HTML content to bundle
 * @param searchDirs - Array of directories to search for images
 */
export async function bundleReportHtmlFromContent(
  htmlContent: string,
  searchDirs: string[]
): Promise<string> {
  try {
    // Find all image references in the HTML
    // Match: src="image.jpg", src='image.png', href="image.gif", background-image: url(image.jpg), url(image.png)
    const imageRegex = /(src|href)\s*=\s*["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']|background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
    const matches = Array.from(htmlContent.matchAll(imageRegex));
    
    let bundledHtml = htmlContent;
    const processedImages = new Set<string>();
    
    for (const match of matches) {
      // Extract image path from match (could be in different capture groups)
      const imagePath = match[2] || match[4] || match[5];
      
      // Skip if imagePath is undefined or already processed or if it's an absolute URL or data URL
      if (!imagePath || processedImages.has(imagePath) || imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
        continue;
      }
      
      // Try to find the image in any of the search directories
      let imageBuffer: Buffer | null = null;
      let mimeType = 'image/jpeg';
      
      for (const searchDir of searchDirs) {
        try {
          const resolvedImagePath = path.resolve(searchDir, imagePath);
          
          // Security check
          const searchDirResolved = path.resolve(searchDir);
          if (!resolvedImagePath.startsWith(searchDirResolved)) {
            continue;
          }
          
          // Check if file exists
          try {
            await fs.access(resolvedImagePath);
            imageBuffer = await fs.readFile(resolvedImagePath);
            
            // Determine MIME type
            const ext = path.extname(resolvedImagePath).toLowerCase();
            switch (ext) {
              case '.png':
                mimeType = 'image/png';
                break;
              case '.gif':
                mimeType = 'image/gif';
                break;
              case '.webp':
                mimeType = 'image/webp';
                break;
              case '.svg':
                mimeType = 'image/svg+xml';
                break;
              case '.jpg':
              case '.jpeg':
              default:
                mimeType = 'image/jpeg';
            }
            
            break; // Found the image, stop searching
          } catch {
            // File doesn't exist in this directory, try next
            continue;
          }
        } catch {
          // Directory doesn't exist or error accessing, try next
          continue;
        }
      }
      
      if (!imageBuffer) {
        console.warn(`[Bundle Report] Image not found in any search directory: ${imagePath}`);
        continue;
      }
      
      // Create data URL
      const imageBase64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${imageBase64}`;
      
      // Replace all occurrences of this image path in the HTML
      const escapedPath = escapeRegex(imagePath);
      const patterns = [
        new RegExp(`src=["']${escapedPath}["']`, 'gi'),
        new RegExp(`href=["']${escapedPath}["']`, 'gi'),
        new RegExp(`background-image:\\s*url\\(["']?${escapedPath}["']?\\)`, 'gi'),
        new RegExp(`url\\(["']?${escapedPath}["']?\\)`, 'gi'),
      ];
      
      for (const pattern of patterns) {
        bundledHtml = bundledHtml.replace(pattern, (match) => {
          if (match.includes('src=')) {
            return match.replace(imagePath, dataUrl);
          } else if (match.includes('href=')) {
            return match.replace(imagePath, dataUrl);
          } else if (match.includes('background-image')) {
            return match.replace(imagePath, dataUrl);
          } else if (match.includes('url(')) {
            return match.replace(imagePath, dataUrl);
          }
          return match;
        });
      }
      
      processedImages.add(imagePath);
      console.log(`[Bundle Report] Embedded image: ${imagePath} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
    }
    
    console.log(`[Bundle Report] Bundled ${processedImages.size} image(s) into HTML`);
    return bundledHtml;
  } catch (error) {
    console.error("[Bundle Report] Error bundling HTML:", error);
    return htmlContent;
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
