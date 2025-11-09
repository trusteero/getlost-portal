#!/usr/bin/env node

/**
 * Script to create books from report folders and seed their reports
 * This creates book entries for all folders in BOOK_REPORTS_PATH that contain reports
 * 
 * Usage:
 *   node scripts/create-books-from-reports.js
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

/**
 * Convert folder name to book title
 * e.g., "the-everlasting-gift" -> "The Everlasting Gift"
 */
function folderNameToTitle(folderName) {
  return folderName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
 * Check if a book already exists
 */
function bookExists(db, title) {
  const books = db.prepare(`
    SELECT id, title
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
 * Create a book in the database
 */
function createBook(db, title, userId = null) {
  // Get first user if no userId provided
  if (!userId) {
    const user = db.prepare(`SELECT id FROM getlostportal_user LIMIT 1`).get();
    if (!user) {
      throw new Error("No users found in database. Please create a user first.");
    }
    userId = user.id;
  }
  
  const bookId = randomUUID();
  db.prepare(`
    INSERT INTO getlostportal_book (
      id, userId, title, description, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    bookId,
    userId,
    title,
    `Demo book: ${title}`,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000)
  );
  
  return { id: bookId, title };
}

/**
 * Create a book version
 */
function createBookVersion(db, bookId, fileName = "demo.pdf") {
  const versionId = randomUUID();
  db.prepare(`
    INSERT INTO getlostportal_book_version (
      id, bookId, versionNumber, fileName, fileUrl, fileSize, fileType, mimeType, uploadedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    versionId,
    bookId,
    1,
    fileName,
    `/api/books/${bookId}/file`,
    0,
    path.extname(fileName).substring(1) || 'pdf',
    'application/pdf',
    Math.floor(Date.now() / 1000)
  );
  
  return versionId;
}

/**
 * Find all report folders
 */
async function findReportFolders() {
  const folders = [];
  
  try {
    const entries = await fs.readdir(BOOK_REPORTS_PATH, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(BOOK_REPORTS_PATH, entry.name);
        
        // Check if folder contains HTML or PDF files
        const files = await fs.readdir(folderPath, { withFileTypes: true });
        const hasReports = files.some(f => {
          const name = f.name.toLowerCase();
          return f.isFile() && (name.endsWith('.html') || name.endsWith('.pdf'));
        });
        
        if (hasReports) {
          folders.push({
            name: entry.name,
            path: folderPath,
            title: folderNameToTitle(entry.name)
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${BOOK_REPORTS_PATH}:`, error);
  }
  
  return folders;
}

async function main() {
  console.log(`\n📚 Creating books from report folders...`);
  console.log(`   Reports path: ${BOOK_REPORTS_PATH}\n`);
  
  // Initialize database
  const db = new Database(DATABASE_PATH);
  console.log(`Connected to database: ${DATABASE_PATH}\n`);
  
  try {
    // Find all report folders
    const folders = await findReportFolders();
    console.log(`Found ${folders.length} folder(s) with reports:\n`);
    
    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    
    for (const folder of folders) {
      try {
        // Check if book already exists
        const existingBook = bookExists(db, folder.title);
        
        if (existingBook) {
          console.log(`⏭️  Book already exists: "${folder.title}"`);
          existingCount++;
        } else {
          // Create book
          const book = createBook(db, folder.title);
          console.log(`✅ Created book: "${book.title}"`);
          
          // Create book version
          const versionId = createBookVersion(db, book.id, `${folder.name}.pdf`);
          console.log(`   └─ Created version: ${versionId.substring(0, 8)}...`);
          
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing "${folder.title}":`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n--- Summary ---`);
    console.log(`✅ Created: ${createdCount} book(s)`);
    console.log(`⏭️  Already existed: ${existingCount} book(s)`);
    console.log(`❌ Errors: ${errorCount} book(s)`);
    console.log(`---------------\n`);
    
    if (createdCount > 0) {
      console.log(`💡 Next step: Run "node scripts/seed-demo-data.js --all" to seed reports for all books\n`);
    }
    
  } finally {
    db.close();
    console.log("Database connection closed.");
  }
}

main().catch(console.error);

