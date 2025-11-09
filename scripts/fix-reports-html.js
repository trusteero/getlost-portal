#!/usr/bin/env node

/**
 * Script to fix reports that exist but have no HTML content in database
 * 
 * This script:
 * 1. Finds all completed reports without HTML content
 * 2. Tries to find matching HTML files in book-reports folder
 * 3. Bundles images and stores HTML content in database
 * 
 * Usage:
 *   node scripts/fix-reports-html.js [--report-id <id>] [--all]
 * 
 * Options:
 *   --report-id <id>    Fix a specific report by ID
 *   --all               Fix all reports without HTML content
 */

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse database path the same way the app does
let dbPath = process.env.DATABASE_URL || './dev.db';
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}
const DATABASE_PATH = dbPath;
const BOOK_REPORTS_PATH = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a filename for comparison (lowercase, remove spaces, special chars)
 */
function normalizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Find a matching report (HTML or PDF) in the book-reports folder
 */
async function findMatchingReport(uploadedFileName, bookTitle) {
  try {
    try {
      await fs.access(BOOK_REPORTS_PATH);
    } catch {
      console.log(`[Fix Reports] Book reports directory not found: ${BOOK_REPORTS_PATH}`);
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
    console.error("[Fix Reports] Error finding matching report:", error);
    return { htmlPath: null, pdfPath: null };
  }
}

/**
 * Bundle report HTML with embedded images (JavaScript version)
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

/**
 * Fix a single report by finding and loading HTML content
 */
async function fixReport(reportId, db) {
  console.log(`\n🔧 Fixing report: ${reportId}`);
  
  try {
    // Get report with book and version info
    const report = db.prepare(`
      SELECT 
        r.id,
        r.status,
        r.bookVersionId,
        bv.fileName,
        bv.bookId,
        b.title as bookTitle
      FROM getlostportal_report r
      JOIN getlostportal_book_version bv ON r.bookVersionId = bv.id
      JOIN getlostportal_book b ON bv.bookId = b.id
      WHERE r.id = ?
    `).get(reportId);
    
    if (!report) {
      console.error(`❌ Report ${reportId} not found`);
      return false;
    }
    
    if (report.status !== 'completed') {
      console.warn(`⚠️  Report ${reportId} is not completed (status: ${report.status})`);
      return false;
    }
    
    // Try to find matching HTML file
    console.log(`  Searching for HTML file matching "${report.fileName}" or book "${report.bookTitle}"...`);
    const matchingReports = await findMatchingReport(report.fileName, report.bookTitle);
    
    if (!matchingReports.htmlPath) {
      console.error(`❌ No matching HTML file found for report ${reportId}`);
      return false;
    }
    
    console.log(`  ✅ Found HTML file: ${matchingReports.htmlPath}`);
    
    // Read and bundle HTML
    const htmlBuffer = await fs.readFile(matchingReports.htmlPath);
    let htmlContent = htmlBuffer.toString('utf-8');
    
    console.log(`  Bundling images...`);
    htmlContent = await bundleReportHtmlInline(matchingReports.htmlPath, htmlContent);
    
    // Update database
    db.prepare(`
      UPDATE getlostportal_report
      SET htmlContent = ?
      WHERE id = ?
    `).run(htmlContent, reportId);
    
    console.log(`  ✅ Successfully updated report ${reportId} with HTML content`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error fixing report ${reportId}:`, error);
    return false;
  }
}

/**
 * Fix all reports without HTML content
 */
async function fixAllReports(db) {
  console.log(`\n🔧 Fixing all reports without HTML content...`);
  
  const reports = db.prepare(`
    SELECT r.id
    FROM getlostportal_report r
    WHERE r.status = 'completed' AND (r.htmlContent IS NULL OR r.htmlContent = '')
    ORDER BY r.requestedAt DESC
  `).all();
  
  console.log(`Found ${reports.length} report(s) without HTML content\n`);
  
  let successCount = 0;
  let failCount = 0;

  for (const report of reports) {
    const success = await fixReport(report.id, db);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n--- Fix Summary ---`);
  console.log(`✅ Successfully fixed: ${successCount}`);
  console.log(`❌ Failed to fix: ${failCount}`);
  console.log(`-------------------`);
}

async function main() {
  const args = process.argv.slice(2);
  const reportIdArg = args.find(arg => arg.startsWith('--report-id='));
  const allArg = args.includes('--all');

  if (!reportIdArg && !allArg) {
    console.error("Usage: node scripts/fix-reports-html.js --report-id <id> | --all");
    process.exit(1);
  }

  // Initialize database connection
  const db = new Database(DATABASE_PATH, { verbose: console.log });
  console.log(`Connected to database: ${DATABASE_PATH}`);

  try {
    if (reportIdArg) {
      const reportId = reportIdArg.split('=')[1];
      await fixReport(reportId, db);
    } else if (allArg) {
      await fixAllReports(db);
    }
  } finally {
    db.close();
    console.log("Database connection closed.");
  }
}

main().catch(console.error);

