#!/usr/bin/env node

/**
 * Script to seed demo data for reports and collateral
 * 
 * This script:
 * 1. Finds all HTML reports in BOOK_REPORTS_PATH
 * 2. Reads and stores them in the database linked to demo book titles
 * 3. Creates demo marketing assets, covers, and landing pages
 * 
 * Note: Images are bundled into HTML as base64 data URLs before storing in database
 * 
 * Usage:
 *   node scripts/seed-demo-data.js [--book-title "Book Title"] [--all]
 * 
 * Options:
 *   --book-title "Title"  Seed data for a specific book title
 *   --all                Seed data for all books found in reports directory
 */

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_URL?.replace(/^file:/, '') || './dev.db';
const BOOK_REPORTS_PATH = process.env.BOOK_REPORTS_PATH || "/Users/eerogetlost/book-reports";

/**
 * Normalize a filename/title for matching
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Find book by title (normalized matching)
 */
function findBookByTitle(db, title) {
  const books = db.prepare(`
    SELECT id, title, userId
    FROM getlostportal_book
    ORDER BY createdAt DESC
  `).all();
  
  const normalizedTitle = normalizeText(title);
  
  for (const book of books) {
    if (normalizeText(book.title) === normalizedTitle) {
      return book;
    }
  }
  
  return null;
}

/**
 * Get or create book version for a book
 */
function getOrCreateBookVersion(db, bookId) {
  const version = db.prepare(`
    SELECT id
    FROM getlostportal_book_version
    WHERE bookId = ?
    ORDER BY versionNumber DESC
    LIMIT 1
  `).get(bookId);
  
  if (version) {
    return version.id;
  }
  
  // Create a version if none exists
  const versionId = randomUUID();
  db.prepare(`
    INSERT INTO getlostportal_book_version (
      id, bookId, versionNumber, fileName, fileUrl, fileSize, fileType, mimeType, uploadedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    versionId,
    bookId,
    1,
    'demo-manuscript.pdf',
    '/api/books/' + bookId + '/file',
    0,
    'application/pdf',
    'application/pdf',
    Math.floor(Date.now() / 1000)
  );
  
  return versionId;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bundle report HTML with embedded images (JavaScript version)
 */
async function bundleReportHtmlInline(htmlFilePath, htmlContent) {
  try {
    const reportDir = path.dirname(htmlFilePath);
    
    // Find all image references in the HTML
    // Match: src="image.jpg", src='image.png', href="image.gif", background-image: url(image.jpg), url(image.png)
    const imageRegex = /(src|href)\s*=\s*["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']|background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
    const matches = Array.from(htmlContent.matchAll(imageRegex));
    
    let bundledHtml = htmlContent;
    const processedImages = new Set();
    
    console.log(`  Found ${matches.length} image reference(s) in HTML`);
    
    for (const match of matches) {
      // Extract image path from match (could be in different capture groups)
      const imagePath = match[2] || match[4] || match[5];
      
      // Skip if undefined, already processed, or absolute URL/data URL
      if (!imagePath || processedImages.has(imagePath) || 
          imagePath.startsWith('http://') || imagePath.startsWith('https://') || 
          imagePath.startsWith('data:')) {
        continue;
      }
      
      try {
        // Resolve image path relative to report directory
        let resolvedImagePath = null;
        
        // Try multiple search strategies:
        // 1. Relative to HTML file directory (most common)
        const tryPath1 = path.resolve(reportDir, imagePath);
        try {
          await fs.access(tryPath1);
          resolvedImagePath = tryPath1;
        } catch {
          // 2. Try in parent directory
          const parentDir = path.dirname(reportDir);
          const tryPath2 = path.resolve(parentDir, imagePath);
          try {
            await fs.access(tryPath2);
            resolvedImagePath = tryPath2;
          } catch {
            // 3. Try searching in subdirectories of reportDir
            try {
              const entries = await fs.readdir(reportDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const tryPath3 = path.resolve(reportDir, entry.name, imagePath);
                  try {
                    await fs.access(tryPath3);
                    resolvedImagePath = tryPath3;
                    break;
                  } catch {
                    // Continue searching
                  }
                }
              }
            } catch {
              // Directory read failed
            }
            
            // 4. Try searching in parent directory's subdirectories
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
                    } catch {
                      // Continue searching
                    }
                  }
                }
              } catch {
                // Directory read failed
              }
            }
          }
        }
        
        if (!resolvedImagePath) {
          console.warn(`  ⚠️  Image not found: ${imagePath} (searched in ${reportDir} and subdirectories)`);
          continue;
        }
        
        // Security check: ensure image is within safe directories
        const reportDirResolved = path.resolve(reportDir);
        const parentDirResolved = path.resolve(path.dirname(reportDir));
        if (!resolvedImagePath.startsWith(reportDirResolved) && 
            !resolvedImagePath.startsWith(parentDirResolved)) {
          console.warn(`  ⚠️  Skipping image outside safe directories: ${imagePath}`);
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
        // Continue processing other images
      }
    }
    
    console.log(`  ✅ Bundled ${processedImages.size} image(s) into HTML`);
    return bundledHtml;
  } catch (error) {
    console.error(`  ❌ Error bundling HTML:`, error);
    // Return original HTML if bundling fails
    return htmlContent;
  }
}

/**
 * Seed report data for a book
 * Bundles images into HTML as base64 data URLs before storing
 * Handles both HTML and PDF files
 */
async function seedReport(db, bookId, bookVersionId, reportFilePath, bookTitle) {
  const fileExt = path.extname(reportFilePath).toLowerCase();
  const isHtml = fileExt === '.html';
  const isPdf = fileExt === '.pdf';
  
  if (!isHtml && !isPdf) {
    console.warn(`  ⚠️  Unsupported file type: ${fileExt}`);
    return false;
  }
  
  console.log(`\n📄 Seeding ${isHtml ? 'HTML' : 'PDF'} report for: ${bookTitle}`);
  
  try {
    let htmlContent = null;
    let pdfUrl = null;
    
    if (isHtml) {
      // Read HTML file
      const htmlBuffer = await fs.readFile(reportFilePath);
      let rawHtmlContent = htmlBuffer.toString('utf-8');
      
      // Bundle images into HTML
      console.log(`  Bundling images...`);
      htmlContent = await bundleReportHtmlInline(reportFilePath, rawHtmlContent);
    } else if (isPdf) {
      // For PDFs, we'll store the file path/URL
      // In production, you might want to upload PDFs to storage and get a URL
      // For now, we'll store a reference path
      pdfUrl = reportFilePath;
      console.log(`  📎 PDF file: ${path.basename(reportFilePath)}`);
    }
    
    // Check if report already exists
    const existingReport = db.prepare(`
      SELECT id
      FROM getlostportal_report
      WHERE bookVersionId = ?
      ORDER BY requestedAt DESC
      LIMIT 1
    `).get(bookVersionId);
    
    if (existingReport) {
      // Update existing report
      const updateData = {
        status: 'completed',
        completedAt: Math.floor(Date.now() / 1000),
        analyzedBy: 'demo@getlost.com'
      };
      
      if (htmlContent) {
        updateData.htmlContent = htmlContent;
      }
      if (pdfUrl) {
        updateData.pdfUrl = pdfUrl;
      }
      
      db.prepare(`
        UPDATE getlostportal_report
        SET htmlContent = ?, pdfUrl = ?, status = ?, completedAt = ?, analyzedBy = ?
        WHERE id = ?
      `).run(
        htmlContent || null,
        pdfUrl || null,
        'completed',
        Math.floor(Date.now() / 1000),
        'demo@getlost.com',
        existingReport.id
      );
      console.log(`  ✅ Updated existing report with ${isHtml ? 'bundled HTML' : 'PDF'}: ${existingReport.id}`);
    } else {
      // Create new report
      const reportId = randomUUID();
      db.prepare(`
        INSERT INTO getlostportal_report (
          id, bookVersionId, status, htmlContent, pdfUrl, requestedAt, completedAt, analyzedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportId,
        bookVersionId,
        'completed',
        htmlContent,
        pdfUrl || null,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000),
        'demo@getlost.com'
      );
      console.log(`  ✅ Created new report with ${isHtml ? 'bundled HTML' : 'PDF'}: ${reportId}`);
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error seeding report:`, error);
    return false;
  }
}

/**
 * Seed marketing assets for a book
 */
function seedMarketingAssets(db, bookId, bookTitle) {
  console.log(`\n🎬 Seeding marketing assets for: ${bookTitle}`);
  
  const assets = [
    {
      assetType: 'video',
      title: 'Book Trailer',
      description: '60-second promotional video for ' + bookTitle,
      fileUrl: '/demo-assets/video-trailer.mp4',
      thumbnailUrl: '/demo-assets/video-thumbnail.jpg',
      metadata: JSON.stringify({ duration: 60, format: 'mp4', resolution: '1920x1080' }),
      status: 'completed'
    },
    {
      assetType: 'social-post',
      title: 'Instagram Post',
      description: 'Square format social media post',
      fileUrl: '/demo-assets/instagram-post.jpg',
      thumbnailUrl: '/demo-assets/instagram-post.jpg',
      metadata: JSON.stringify({ platform: 'instagram', format: 'square', dimensions: '1080x1080' }),
      status: 'completed'
    },
    {
      assetType: 'banner',
      title: 'Website Banner',
      description: 'Header banner for website',
      fileUrl: '/demo-assets/website-banner.jpg',
      thumbnailUrl: '/demo-assets/website-banner.jpg',
      metadata: JSON.stringify({ format: 'banner', dimensions: '1920x400' }),
      status: 'completed'
    }
  ];
  
  // Delete existing assets
  db.prepare(`DELETE FROM getlostportal_marketing_asset WHERE bookId = ?`).run(bookId);
  
  let created = 0;
  for (const asset of assets) {
    const assetId = randomUUID();
    db.prepare(`
      INSERT INTO getlostportal_marketing_asset (
        id, bookId, assetType, title, description, fileUrl, thumbnailUrl, metadata, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assetId,
      bookId,
      asset.assetType,
      asset.title,
      asset.description,
      asset.fileUrl,
      asset.thumbnailUrl,
      asset.metadata,
      asset.status,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );
    created++;
  }
  
  console.log(`  ✅ Created ${created} marketing assets`);
  return created;
}

/**
 * Seed book covers for a book
 */
function seedBookCovers(db, bookId, bookTitle) {
  console.log(`\n📚 Seeding book covers for: ${bookTitle}`);
  
  const covers = [
    {
      coverType: 'ebook',
      title: 'eBook Cover',
      imageUrl: '/demo-assets/cover-ebook.jpg',
      thumbnailUrl: '/demo-assets/cover-ebook-thumb.jpg',
      metadata: JSON.stringify({ format: 'ebook', dimensions: '1600x2560' }),
      isPrimary: true,
      status: 'completed'
    },
    {
      coverType: 'paperback',
      title: 'Paperback Cover',
      imageUrl: '/demo-assets/cover-paperback.jpg',
      thumbnailUrl: '/demo-assets/cover-paperback-thumb.jpg',
      metadata: JSON.stringify({ format: 'paperback', dimensions: '1800x2700' }),
      isPrimary: false,
      status: 'completed'
    },
    {
      coverType: 'hardcover',
      title: 'Hardcover Design',
      imageUrl: '/demo-assets/cover-hardcover.jpg',
      thumbnailUrl: '/demo-assets/cover-hardcover-thumb.jpg',
      metadata: JSON.stringify({ format: 'hardcover', dimensions: '2000x3000' }),
      isPrimary: false,
      status: 'completed'
    }
  ];
  
  // Delete existing covers
  db.prepare(`DELETE FROM getlostportal_book_cover WHERE bookId = ?`).run(bookId);
  
  let created = 0;
  for (const cover of covers) {
    const coverId = randomUUID();
    db.prepare(`
      INSERT INTO getlostportal_book_cover (
        id, bookId, coverType, title, imageUrl, thumbnailUrl, metadata, isPrimary, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      coverId,
      bookId,
      cover.coverType,
      cover.title,
      cover.imageUrl,
      cover.thumbnailUrl,
      cover.metadata,
      cover.isPrimary ? 1 : 0,
      cover.status,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );
    created++;
  }
  
  console.log(`  ✅ Created ${created} book covers`);
  return created;
}

/**
 * Seed landing page for a book
 */
function seedLandingPage(db, bookId, bookTitle) {
  console.log(`\n🌐 Seeding landing page for: ${bookTitle}`);
  
  const slug = normalizeText(bookTitle).substring(0, 50);
  const headline = `Discover ${bookTitle}`;
  const subheadline = `A captivating story that will keep you turning pages`;
  const description = `Experience the journey of ${bookTitle}. This compelling narrative takes readers on an unforgettable adventure filled with intrigue, emotion, and unforgettable characters.`;
  
  const htmlContent = `
    <div class="landing-page">
      <section class="hero">
        <h1>${headline}</h1>
        <p class="subheadline">${subheadline}</p>
        <a href="#" class="cta-button">Get Your Copy Today</a>
      </section>
      <section class="about">
        <h2>About the Book</h2>
        <p>${description}</p>
      </section>
      <section class="reviews">
        <h2>What Readers Are Saying</h2>
        <div class="review">
          <p>"An absolutely captivating read!" - Book Reviewer</p>
        </div>
      </section>
    </div>
  `;
  
  // Check if landing page exists
  const existing = db.prepare(`
    SELECT id
    FROM getlostportal_landing_page
    WHERE bookId = ?
    LIMIT 1
  `).get(bookId);
  
  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE getlostportal_landing_page
      SET title = ?, headline = ?, subheadline = ?, description = ?, htmlContent = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      bookTitle,
      headline,
      subheadline,
      description,
      htmlContent,
      Math.floor(Date.now() / 1000),
      existing.id
    );
    console.log(`  ✅ Updated existing landing page: ${existing.id}`);
  } else {
    // Create new
    const landingPageId = randomUUID();
    db.prepare(`
      INSERT INTO getlostportal_landing_page (
        id, bookId, slug, title, headline, subheadline, description, htmlContent, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      landingPageId,
      bookId,
      slug,
      bookTitle,
      headline,
      subheadline,
      description,
      htmlContent,
      'draft',
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );
    console.log(`  ✅ Created new landing page: ${landingPageId}`);
  }
  
  return true;
}

/**
 * Find all HTML and PDF reports in the reports directory
 */
async function findReportFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
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
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const bookTitleArg = args.find(arg => arg.startsWith('--book-title='));
  const allArg = args.includes('--all');
  
  if (!bookTitleArg && !allArg) {
    console.error("Usage: node scripts/seed-demo-data.js --book-title \"Book Title\" | --all");
    process.exit(1);
  }
  
  // Initialize database
  const db = new Database(DATABASE_PATH);
  console.log(`Connected to database: ${DATABASE_PATH}`);
  
  try {
    if (bookTitleArg) {
      // Seed for specific book
      const bookTitle = bookTitleArg.split('=')[1].replace(/^["']|["']$/g, '');
      const book = findBookByTitle(db, bookTitle);
      
      if (!book) {
        console.error(`❌ Book not found: "${bookTitle}"`);
        console.log(`Available books:`);
        const allBooks = db.prepare(`SELECT title FROM getlostportal_book ORDER BY createdAt DESC`).all();
        allBooks.forEach(b => console.log(`  - ${b.title}`));
        process.exit(1);
      }
      
      const bookVersionId = getOrCreateBookVersion(db, book.id);
      
      // Find matching reports (HTML or PDF) - prefer HTML
      const reportFiles = await findReportFiles(BOOK_REPORTS_PATH);
      const normalizedTitle = normalizeText(bookTitle);
      
      let matchedReport = null;
      let matchedHtml = null;
      let matchedPdf = null;
      
      for (const reportFile of reportFiles) {
        const normalizedFileName = normalizeText(reportFile.name);
        const normalizedFolder = normalizeText(reportFile.folder);
        
        const matches = normalizedFileName.includes(normalizedTitle) || 
            normalizedFolder === normalizedTitle ||
            normalizedTitle.includes(normalizedFileName);
        
        if (matches) {
          if (reportFile.type === 'html' && !matchedHtml) {
            matchedHtml = reportFile;
          } else if (reportFile.type === 'pdf' && !matchedPdf) {
            matchedPdf = reportFile;
          }
        }
      }
      
      // Prefer HTML, but use PDF if HTML not found
      matchedReport = matchedHtml || matchedPdf;
      
      if (matchedReport) {
        await seedReport(db, book.id, bookVersionId, matchedReport.path, bookTitle);
      } else {
        console.warn(`⚠️  No matching report found for "${bookTitle}"`);
      }
      
      seedMarketingAssets(db, book.id, bookTitle);
      seedBookCovers(db, book.id, bookTitle);
      seedLandingPage(db, book.id, bookTitle);
      
      console.log(`\n✅ Successfully seeded demo data for: ${bookTitle}`);
    } else if (allArg) {
      // Seed for all books
      const books = db.prepare(`SELECT id, title FROM getlostportal_book ORDER BY createdAt DESC`).all();
      const reportFiles = await findReportFiles(BOOK_REPORTS_PATH);
      
      console.log(`\nFound ${books.length} books and ${reportFiles.length} report files`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const book of books) {
        try {
          const bookVersionId = getOrCreateBookVersion(db, book.id);
          
          // Try to find matching report (prefer HTML, but accept PDF)
          const normalizedTitle = normalizeText(book.title);
          let matchedReport = null;
          let matchedHtml = null;
          let matchedPdf = null;
          
          for (const reportFile of reportFiles) {
            const normalizedFileName = normalizeText(reportFile.name);
            const normalizedFolder = normalizeText(reportFile.folder);
            
            const matches = normalizedFileName.includes(normalizedTitle) || 
                normalizedFolder === normalizedTitle ||
                normalizedTitle.includes(normalizedFileName);
            
            if (matches) {
              if (reportFile.type === 'html' && !matchedHtml) {
                matchedHtml = reportFile;
              } else if (reportFile.type === 'pdf' && !matchedPdf) {
                matchedPdf = reportFile;
              }
            }
          }
          
          // Prefer HTML, but use PDF if HTML not found
          matchedReport = matchedHtml || matchedPdf;
          
          if (matchedReport) {
            await seedReport(db, book.id, bookVersionId, matchedReport.path, book.title);
          } else {
            console.log(`  ⚠️  No matching report found for "${book.title}"`);
          }
          
          seedMarketingAssets(db, book.id, book.title);
          seedBookCovers(db, book.id, book.title);
          seedLandingPage(db, book.id, book.title);
          
          successCount++;
        } catch (error) {
          console.error(`❌ Error seeding data for "${book.title}":`, error);
          failCount++;
        }
      }
      
      console.log(`\n--- Seeding Summary ---`);
      console.log(`✅ Successfully seeded: ${successCount} books`);
      console.log(`❌ Failed to seed: ${failCount} books`);
      console.log(`------------------------`);
    }
  } finally {
    db.close();
    console.log("\nDatabase connection closed.");
  }
}

main().catch(console.error);

