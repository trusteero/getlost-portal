#!/usr/bin/env node

/**
 * Quick fix script to populate HTML for a specific report
 * Usage: node scripts/quick-fix-report.js <report-id>
 * 
 * The script will automatically find the matching HTML file based on book title and filename
 */

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const reportId = process.argv[2];

if (!reportId) {
  console.error("Usage: node scripts/quick-fix-report.js <report-id>");
  process.exit(1);
}

// Parse database path
let dbPath = process.env.DATABASE_URL || './dev.db';
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

const BOOK_REPORTS_PATH = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";

/**
 * Normalize a filename for comparison
 */
function normalizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Find matching report HTML file
 */
async function findMatchingReport(uploadedFileName, bookTitle) {
  try {
    try {
      await fs.access(BOOK_REPORTS_PATH);
    } catch {
      console.log(`[Fix] Book reports directory not found: ${BOOK_REPORTS_PATH}`);
      return { htmlPath: null, pdfPath: null };
    }

    const normalizedUploaded = normalizeFilename(uploadedFileName);
    const normalizedTitle = bookTitle ? normalizeFilename(bookTitle) : null;

    async function findReportFiles(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
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
    let htmlPath = null;
    let pdfPath = null;

    for (const file of allFiles) {
      const normalizedFileName = normalizeFilename(file.name);
      const normalizedFolder = normalizeFilename(file.folder);

      const matchesFilename = normalizedFileName === normalizedUploaded ||
        normalizedFileName.includes(normalizedUploaded) ||
        normalizedUploaded.includes(normalizedFileName);
      
      const matchesFolder = normalizedTitle && normalizedFolder === normalizedTitle;

      if (matchesFilename || matchesFolder) {
        if (file.type === 'html' && !htmlPath) {
          htmlPath = file.path;
        } else if (file.type === 'pdf' && !pdfPath) {
          pdfPath = file.path;
        }
      }
    }

    return { htmlPath, pdfPath };
  } catch (error) {
    console.error("[Fix] Error finding matching report:", error);
    return { htmlPath: null, pdfPath: null };
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bundle report HTML with embedded images
 */
async function bundleReportHtmlInline(htmlFilePath, htmlContent) {
  try {
    const reportDir = path.dirname(htmlFilePath);
    
    const imageRegex = /(src|href|background-image:\s*url)\(?["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)?/gi;
    const matches = Array.from(htmlContent.matchAll(imageRegex));
    
    let bundledHtml = htmlContent;
    const processedImages = new Set();
    
    for (const match of matches) {
      const imagePath = match[2];
      
      if (!imagePath || processedImages.has(imagePath) || 
          imagePath.startsWith('http://') || imagePath.startsWith('https://') || 
          imagePath.startsWith('data:')) {
        continue;
      }
      
      try {
        const resolvedImagePath = path.resolve(reportDir, imagePath);
        const reportDirResolved = path.resolve(reportDir);
        if (!resolvedImagePath.startsWith(reportDirResolved)) {
          continue;
        }
        
        try {
          await fs.access(resolvedImagePath);
        } catch {
          continue;
        }
        
        const imageBuffer = await fs.readFile(resolvedImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        
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
        
        const dataUrl = `data:${mimeType};base64,${imageBase64}`;
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
        console.log(`  ✅ Embedded image: ${imagePath} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
      } catch (error) {
        console.error(`  ❌ Failed to embed image ${imagePath}:`, error.message);
      }
    }
    
    console.log(`  ✅ Bundled ${processedImages.size} image(s) into HTML`);
    return bundledHtml;
  } catch (error) {
    console.error(`  ❌ Error bundling HTML:`, error);
    return htmlContent;
  }
}

const db = new Database(dbPath);

try {
  // Get report info
  const report = db.prepare(`
    SELECT r.id, r.status, r.bookVersionId, bv.fileName, bv.bookId, b.title as bookTitle
    FROM getlostportal_report r
    JOIN getlostportal_book_version bv ON r.bookVersionId = bv.id
    JOIN getlostportal_book b ON bv.bookId = b.id
    WHERE r.id = ?
  `).get(reportId);

  if (!report) {
    console.error(`❌ Report ${reportId} not found in database`);
    console.error(`   Database: ${dbPath}`);
    process.exit(1);
  }

  console.log(`📄 Found report for: ${report.bookTitle}`);
  console.log(`   File: ${report.fileName}`);
  console.log(`   Status: ${report.status}`);

  console.log(`\n🔍 Searching for HTML file matching "${report.fileName}" or book "${report.bookTitle}"...`);

  const matchingReports = await findMatchingReport(report.fileName, report.bookTitle);

  if (!matchingReports.htmlPath) {
    console.error(`❌ No matching HTML file found`);
    console.error(`   Searched in: ${BOOK_REPORTS_PATH}`);
    process.exit(1);
  }

  console.log(`✅ Found HTML file: ${matchingReports.htmlPath}`);

  // Read and bundle HTML
  const htmlBuffer = await fs.readFile(matchingReports.htmlPath);
  let htmlContent = htmlBuffer.toString('utf-8');

  console.log(`📦 Bundling images...`);
  htmlContent = await bundleReportHtmlInline(matchingReports.htmlPath, htmlContent);

  // Update database
  db.prepare(`
    UPDATE getlostportal_report
    SET htmlContent = ?
    WHERE id = ?
  `).run(htmlContent, reportId);

  console.log(`✅ Successfully updated report ${reportId} with HTML content`);
  console.log(`   HTML size: ${(htmlContent.length / 1024).toFixed(1)}KB`);

} catch (error) {
  console.error(`❌ Error:`, error);
  process.exit(1);
} finally {
  db.close();
}
