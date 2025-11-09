#!/usr/bin/env node

/**
 * Script to bundle existing HTML reports into single-file versions
 * This converts reports stored in the database to include embedded images
 * 
 * Usage:
 *   node scripts/bundle-reports.js [--report-id <id>] [--all] [--book-reports-dir <path>]
 * 
 * Options:
 *   --report-id <id>    Bundle a specific report by ID
 *   --all               Bundle all reports in the database
 *   --book-reports-dir  Path to book-reports directory (default: BOOK_REPORTS_PATH env var or /Users/eerogetlost/book-reports)
 */

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bundle HTML content, searching for images in multiple directories
 */
async function bundleReportHtmlFromContent(htmlContent, searchDirs) {
  try {
    // Find all image references in the HTML
    // Match: src="image.jpg", src='image.png', href="image.gif", background-image: url(image.jpg), url(image.png)
    const imageRegex = /(src|href)\s*=\s*["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']|background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
    const matches = Array.from(htmlContent.matchAll(imageRegex));
    
    let bundledHtml = htmlContent;
    const processedImages = new Set();
    
    for (const match of matches) {
      // Extract image path from match (could be in different capture groups)
      const imagePath = match[2] || match[4] || match[5];
      
      // Skip if already processed or if it's an absolute URL or data URL
      if (processedImages.has(imagePath) || imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
        continue;
      }
      
      // Try to find the image in any of the search directories
      let imageBuffer = null;
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
      const patterns = [
        new RegExp(`src=["']${escapeRegex(imagePath)}["']`, 'gi'),
        new RegExp(`href=["']${escapeRegex(imagePath)}["']`, 'gi'),
        new RegExp(`background-image:\\s*url\\(["']?${escapeRegex(imagePath)}["']?\\)`, 'gi'),
        new RegExp(`url\\(["']?${escapeRegex(imagePath)}["']?\\)`, 'gi'),
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

const DATABASE_PATH = process.env.DATABASE_URL?.replace(/^file:/, '') || './data.db';
const BOOK_REPORTS_PATH = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";
const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH || './uploads/reports';

async function bundleReport(reportId, db) {
  console.log(`\n📦 Bundling report: ${reportId}`);
  
  try {
    // Get report from database
    const report = db.prepare(`
      SELECT id, htmlContent, bookVersionId
      FROM getlostportal_report
      WHERE id = ?
    `).get(reportId);
    
    if (!report) {
      console.error(`❌ Report ${reportId} not found`);
      return false;
    }
    
    if (!report.htmlContent) {
      console.warn(`⚠️  Report ${reportId} has no HTML content`);
      return false;
    }
    
    // Get book version info to find related files
    const bookVersion = db.prepare(`
      SELECT fileName, bookId
      FROM getlostportal_book_version
      WHERE id = ?
    `).get(report.bookVersionId);
    
    // Build search directories
    const searchDirs = [];
    
    // 1. Report storage directory
    try {
      await fs.access(REPORT_STORAGE_PATH);
      searchDirs.push(REPORT_STORAGE_PATH);
    } catch {
      console.warn(`⚠️  Report storage directory not found: ${REPORT_STORAGE_PATH}`);
    }
    
    // 2. Book reports directory (where original reports are stored)
    try {
      await fs.access(BOOK_REPORTS_PATH);
      searchDirs.push(BOOK_REPORTS_PATH);
      
      // Also try subdirectories if we have book info
      if (bookVersion) {
        // Try to find matching folder by filename or book title
        const entries = await fs.readdir(BOOK_REPORTS_PATH, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            searchDirs.push(path.join(BOOK_REPORTS_PATH, entry.name));
          }
        }
      }
    } catch {
      console.warn(`⚠️  Book reports directory not found: ${BOOK_REPORTS_PATH}`);
    }
    
    if (searchDirs.length === 0) {
      console.error(`❌ No search directories available for images`);
      return false;
    }
    
    console.log(`🔍 Searching for images in: ${searchDirs.join(', ')}`);
    
    // Bundle the HTML
    const bundledHtml = await bundleReportHtmlFromContent(report.htmlContent, searchDirs);
    
    // Update database with bundled HTML
    db.prepare(`
      UPDATE getlostportal_report
      SET htmlContent = ?
      WHERE id = ?
    `).run(bundledHtml, reportId);
    
    // Also save to file system if it exists
    try {
      await fs.mkdir(REPORT_STORAGE_PATH, { recursive: true });
      const htmlFilePath = path.join(REPORT_STORAGE_PATH, `${reportId}.html`);
      await fs.writeFile(htmlFilePath, bundledHtml, 'utf-8');
      console.log(`✅ Saved bundled report to: ${htmlFilePath}`);
    } catch (error) {
      console.warn(`⚠️  Could not save to file system:`, error);
    }
    
    console.log(`✅ Successfully bundled report ${reportId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error bundling report ${reportId}:`, error);
    return false;
  }
}

async function bundleAllReports(db) {
  console.log(`\n📦 Bundling all reports...`);
  
  const reports = db.prepare(`
    SELECT id
    FROM getlostportal_report
    WHERE htmlContent IS NOT NULL AND htmlContent != ''
    ORDER BY requestedAt DESC
  `).all();
  
  console.log(`Found ${reports.length} reports to bundle\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const report of reports) {
    const success = await bundleReport(report.id, db);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully bundled: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📝 Total: ${reports.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const reportIdIndex = args.indexOf('--report-id');
  const allIndex = args.indexOf('--all');
  const bookReportsDirIndex = args.indexOf('--book-reports-dir');
  
  // Parse book-reports-dir if provided
  if (bookReportsDirIndex !== -1 && args[bookReportsDirIndex + 1]) {
    process.env.BOOK_REPORTS_PATH = args[bookReportsDirIndex + 1];
  }
  
  // Open database
  const db = new Database(DATABASE_PATH);
  
  try {
    if (reportIdIndex !== -1 && args[reportIdIndex + 1]) {
      // Bundle specific report
      const id = args[reportIdIndex + 1];
      await bundleReport(id, db);
    } else if (allIndex !== -1) {
      // Bundle all reports
      await bundleAllReports(db);
    } else {
      console.log(`
Usage:
  node scripts/bundle-reports.js [options]

Options:
  --report-id <id>         Bundle a specific report by ID
  --all                    Bundle all reports in the database
  --book-reports-dir <path> Path to book-reports directory

Examples:
  node scripts/bundle-reports.js --report-id abc123
  node scripts/bundle-reports.js --all
  node scripts/bundle-reports.js --all --book-reports-dir /path/to/reports
      `);
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

