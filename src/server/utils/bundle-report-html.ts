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
        let resolvedImagePath: string | null = null;
        
        // Try multiple search strategies:
        // 1. Relative to HTML file directory
        const tryPath1 = path.resolve(reportDir, imagePath);
        if (await fs.access(tryPath1).then(() => true).catch(() => false)) {
          resolvedImagePath = tryPath1;
        } else {
          // 2. Try in parent directory (common structure)
          const parentDir = path.dirname(reportDir);
          const tryPath2 = path.resolve(parentDir, imagePath);
          if (await fs.access(tryPath2).then(() => true).catch(() => false)) {
            resolvedImagePath = tryPath2;
          } else {
            // 3. Try searching in subdirectories of reportDir
            try {
              const entries = await fs.readdir(reportDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const tryPath3 = path.resolve(reportDir, entry.name, imagePath);
                  if (await fs.access(tryPath3).then(() => true).catch(() => false)) {
                    resolvedImagePath = tryPath3;
                    break;
                  }
                }
              }
            } catch {
              // Directory read failed, continue
            }
            
            // 4. Try searching in parent directory's subdirectories
            if (!resolvedImagePath) {
              try {
                const parentEntries = await fs.readdir(parentDir, { withFileTypes: true });
                for (const entry of parentEntries) {
                  if (entry.isDirectory()) {
                    const tryPath4 = path.resolve(parentDir, entry.name, imagePath);
                    if (await fs.access(tryPath4).then(() => true).catch(() => false)) {
                      resolvedImagePath = tryPath4;
                      break;
                    }
                  }
                }
              } catch {
                // Directory read failed, continue
              }
            }
          }
        }
        
        if (!resolvedImagePath) {
          console.warn(`[Bundle Report] Image not found: ${imagePath} (searched relative to ${reportDir})`);
          continue;
        }
        
        // Security check: ensure the image is within a safe directory
        const reportDirResolved = path.resolve(reportDir);
        const parentDirResolved = path.resolve(path.dirname(reportDir));
        if (!resolvedImagePath.startsWith(reportDirResolved) && 
            !resolvedImagePath.startsWith(parentDirResolved)) {
          console.warn(`[Bundle Report] Skipping image outside safe directories: ${imagePath}`);
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
      let foundImagePath: string | null = null;
      
      for (const searchDir of searchDirs) {
        try {
          // Try direct path
          const tryPath1 = path.resolve(searchDir, imagePath);
          if (await fs.access(tryPath1).then(() => true).catch(() => false)) {
            imageBuffer = await fs.readFile(tryPath1);
            foundImagePath = tryPath1;
            
            // Determine MIME type
            const ext = path.extname(tryPath1).toLowerCase();
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
            break;
          }
          
          // Try in subdirectories
          try {
            const entries = await fs.readdir(searchDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const tryPath2 = path.resolve(searchDir, entry.name, imagePath);
                if (await fs.access(tryPath2).then(() => true).catch(() => false)) {
                  imageBuffer = await fs.readFile(tryPath2);
                  foundImagePath = tryPath2;
                  
                  // Determine MIME type
                  const ext = path.extname(tryPath2).toLowerCase();
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
                  break;
                }
              }
            }
            if (imageBuffer) break;
          } catch {
            // Directory read failed, try next search directory
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
