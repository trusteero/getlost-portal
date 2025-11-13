#!/usr/bin/env node

/**
 * Script to seed reports without creating books
 * Reports are stored and can be matched by filename when authors upload books
 * 
 * Usage:
 *   node scripts/seed-reports-only.js
 */

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse database path
let dbPath = process.env.DATABASE_URL || './dev.db';
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

const DATABASE_PATH = dbPath;
const BOOK_REPORTS_PATH = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";

// Ensure database directory exists
async function ensureDatabaseDirectory() {
  const dbDir = path.dirname(DATABASE_PATH);
  
  // For production paths like /var/data, ensure directory exists
  if (dbDir.startsWith('/var/') || dbDir.startsWith('/mnt/')) {
    try {
      await fs.access(dbDir);
      console.log(`✅ Database directory exists: ${dbDir}`);
    } catch {
      console.log(`📁 Creating database directory: ${dbDir}`);
      try {
        await fs.mkdir(dbDir, { recursive: true });
        console.log(`✅ Created database directory: ${dbDir}`);
      } catch (mkdirError) {
        console.error(`❌ Failed to create database directory: ${mkdirError.message}`);
        throw new Error(`Cannot create database directory: ${dbDir}. Make sure the persistent disk is mounted.`);
      }
    }
  }
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
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
    
    const imageRegex = /(src|href)\s*=\s*["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']|background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
    const matches = Array.from(htmlContent.matchAll(imageRegex));
    
    let bundledHtml = htmlContent;
    const processedImages = new Set();
    
    console.log(`  Found ${matches.length} image reference(s) in HTML`);
    
    for (const match of matches) {
      const imagePath = match[2] || match[4] || match[5];
      
      if (!imagePath || processedImages.has(imagePath) || 
          imagePath.startsWith('http://') || imagePath.startsWith('https://') || 
          imagePath.startsWith('data:')) {
        continue;
      }
      
      let resolvedImagePath = null;
      
      // Try multiple search strategies
      const tryPath1 = path.resolve(reportDir, imagePath);
      try {
        await fs.access(tryPath1);
        resolvedImagePath = tryPath1;
      } catch {
        const parentDir = path.dirname(reportDir);
        const tryPath2 = path.resolve(parentDir, imagePath);
        try {
          await fs.access(tryPath2);
          resolvedImagePath = tryPath2;
        } catch {
          try {
            const entries = await fs.readdir(reportDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const tryPath3 = path.resolve(reportDir, entry.name, imagePath);
                try {
                  await fs.access(tryPath3);
                  resolvedImagePath = tryPath3;
                  break;
                } catch {}
              }
            }
          } catch {}
          
          if (!resolvedImagePath) {
            try {
              const parentEntries = await fs.readdir(parentDir, { withFileTypes: true });
              for (const entry of parentEntries) {
                if (entry.isDirectory()) {
                  const tryPath4 = path.resolve(parentDir, entry.name, imagePath);
                  try {
                    await fs.access(tryPath4);
                    resolvedImagePath = tryPath4;
                    break;
                  } catch {}
                }
              }
            } catch {}
          }
        }
      }
      
      if (!resolvedImagePath) {
        console.warn(`  ⚠️  Image not found: ${imagePath}`);
        continue;
      }
      
      try {
        const imageBuffer = await fs.readFile(resolvedImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        
        const ext = path.extname(resolvedImagePath).toLowerCase();
        let mimeType = 'image/jpeg';
        
        switch (ext) {
          case '.png': mimeType = 'image/png'; break;
          case '.gif': mimeType = 'image/gif'; break;
          case '.webp': mimeType = 'image/webp'; break;
          case '.svg': mimeType = 'image/svg+xml'; break;
          case '.jpg': case '.jpeg': default: mimeType = 'image/jpeg'; break;
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
            if (match.includes('src=')) return match.replace(imagePath, dataUrl);
            if (match.includes('href=')) return match.replace(imagePath, dataUrl);
            if (match.includes('background-image')) return match.replace(imagePath, dataUrl);
            if (match.includes('url(')) return match.replace(imagePath, dataUrl);
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
 * Find all report files
 */
async function findReportFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await findReportFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if (lowerName.endsWith('.html') || lowerName.endsWith('.pdf')) {
          files.push({
            path: fullPath,
            name: entry.name,
            folder: path.basename(path.dirname(fullPath)),
            type: lowerName.endsWith('.html') ? 'html' : 'pdf'
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * Get or create system book and version for seeded reports
 */
function getOrCreateSystemBookVersion(db) {
  // Check if system book exists
  let systemBook = db.prepare(`
    SELECT id FROM getlostportal_book 
    WHERE title = 'SYSTEM_SEEDED_REPORTS' 
    LIMIT 1
  `).get();
  
  if (!systemBook) {
    // Get first user (or create system user)
    const user = db.prepare(`SELECT id FROM getlostportal_user LIMIT 1`).get();
    if (!user) {
      throw new Error("No users found. Please create a user first.");
    }
    
    // Create system book
    const bookId = randomUUID();
    db.prepare(`
      INSERT INTO getlostportal_book (
        id, userId, title, description, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      bookId,
      user.id,
      'SYSTEM_SEEDED_REPORTS',
      'System book for seeded reports - not visible to users',
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );
    
    systemBook = { id: bookId };
  }
  
  // Check if system book version exists
  let systemVersion = db.prepare(`
    SELECT id FROM getlostportal_book_version 
    WHERE bookId = ? AND fileName = 'SYSTEM_SEEDED_VERSION'
    LIMIT 1
  `).get(systemBook.id);
  
  if (!systemVersion) {
    // Create system book version
    const versionId = randomUUID();
    db.prepare(`
      INSERT INTO getlostportal_book_version (
        id, bookId, versionNumber, fileName, fileUrl, fileSize, fileType, mimeType, uploadedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      systemBook.id,
      1,
      'SYSTEM_SEEDED_VERSION',
      '/system/seeded',
      0,
      'system',
      'application/system',
      Math.floor(Date.now() / 1000)
    );
    
    systemVersion = { id: versionId };
  }
  
  return systemVersion.id;
}

/**
 * Store report in database with filename for matching
 * Links to system book version, stores filename in adminNotes
 */
async function storeSeededReport(db, reportFilePath, fileName, folderName, systemBookVersionId) {
  const fileExt = path.extname(reportFilePath).toLowerCase();
  const isHtml = fileExt === '.html';
  const isPdf = fileExt === '.pdf';
  
  if (!isHtml && !isPdf) {
    return false;
  }
  
  try {
    let htmlContent = null;
    let pdfUrl = null;
    
    if (isHtml) {
      const htmlBuffer = await fs.readFile(reportFilePath);
      let rawHtmlContent = htmlBuffer.toString('utf-8');
      
      console.log(`  Bundling images...`);
      htmlContent = await bundleReportHtmlInline(reportFilePath, rawHtmlContent);
    } else if (isPdf) {
      pdfUrl = reportFilePath;
      console.log(`  📎 PDF file: ${path.basename(reportFilePath)}`);
    }
    
    // Store report linked to system book version
    // Filename stored in adminNotes for matching
    const reportId = randomUUID();
    
    db.prepare(`
      INSERT INTO getlostportal_report (
        id, bookVersionId, status, htmlContent, pdfUrl, adminNotes, requestedAt, completedAt, analyzedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      systemBookVersionId, // Link to system book version
      'completed',
      htmlContent,
      pdfUrl || null,
      JSON.stringify({ 
        seededFileName: fileName,
        seededFolder: folderName,
        seededPath: reportFilePath,
        uploadFileNames: [fileName],
        isSeeded: true
      }),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000),
      'system@getlost.com'
    );
    
    console.log(`  ✅ Stored seeded report: ${reportId.substring(0, 8)}... (${fileName})`);
    return reportId;
  } catch (error) {
    console.error(`  ❌ Error storing report:`, error);
    return null;
  }
}

async function main() {
  console.log(`\n📚 Seeding reports (without creating books)...`);
  console.log(`   Reports path: ${BOOK_REPORTS_PATH}\n`);
  
  // Ensure database directory exists before connecting
  await ensureDatabaseDirectory();
  
  const db = new Database(DATABASE_PATH);
  console.log(`Connected to database: ${DATABASE_PATH}\n`);
  
  try {
    // Delete existing demo reports
    console.log(`🧹 Cleaning up existing demo reports...`);
    const deleted = db.prepare(`
      DELETE FROM getlostportal_report 
      WHERE analyzedBy = 'system@getlost.com' OR adminNotes LIKE '%"isSeeded":true%'
    `).run();
    console.log(`   Deleted ${deleted.changes} existing demo report(s)\n`);
    
    // Find all report files
    const reportFiles = await findReportFiles(BOOK_REPORTS_PATH);
    console.log(`Found ${reportFiles.length} report file(s)\n`);
    
    // Group by folder and prefer HTML over PDF
    const reportsByFolder = {};
    for (const file of reportFiles) {
      if (!reportsByFolder[file.folder]) {
        reportsByFolder[file.folder] = { html: null, pdf: null };
      }
      if (file.type === 'html' && !reportsByFolder[file.folder].html) {
        reportsByFolder[file.folder].html = file;
      } else if (file.type === 'pdf' && !reportsByFolder[file.folder].pdf) {
        reportsByFolder[file.folder].pdf = file;
      }
    }
    
    // Get or create system book version for seeded reports
    const systemBookVersionId = getOrCreateSystemBookVersion(db);
    console.log(`📦 Using system book version: ${systemBookVersionId.substring(0, 8)}...\n`);
    
    let seededCount = 0;
    let errorCount = 0;
    
    for (const [folder, files] of Object.entries(reportsByFolder)) {
      const reportFile = files.html || files.pdf;
      if (!reportFile) continue;
      
      try {
        console.log(`📄 Processing: ${reportFile.name} (${reportFile.type.toUpperCase()})`);
        const reportId = await storeSeededReport(db, reportFile.path, reportFile.name, folder, systemBookVersionId);
        if (reportId) {
          seededCount++;
        } else {
          errorCount++;
        }
        console.log('');
      } catch (error) {
        console.error(`❌ Error processing ${reportFile.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`--- Summary ---`);
    console.log(`✅ Seeded: ${seededCount} report(s)`);
    console.log(`❌ Errors: ${errorCount} report(s)`);
    console.log(`---------------\n`);
    
  } finally {
    db.close();
    console.log("Database connection closed.");
  }
}

main().catch(console.error);

