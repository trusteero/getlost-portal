#!/usr/bin/env node
/**
 * Debug script to check cover image status
 * Usage: node scripts/debug-covers.js [bookId]
 */

import { db } from '../src/server/db/index.js';
import { books } from '../src/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';

async function debugCovers() {
  const bookId = process.argv[2];

  console.log('=== Cover Image Debug ===\n');
  console.log(`process.cwd(): ${process.cwd()}\n`);

  if (bookId) {
    // Debug specific book
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
        coverImageUrl: books.coverImageUrl,
      })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book) {
      console.log(`Book not found: ${bookId}`);
      return;
    }

    console.log(`Book: ${book.title}`);
    console.log(`Cover Image URL: ${book.coverImageUrl || '(none)'}\n`);

    if (book.coverImageUrl) {
      // Extract filename from URL
      const urlMatch = book.coverImageUrl.match(/\/api\/covers\/(.+)$/);
      if (urlMatch) {
        const filename = urlMatch[1];
        console.log(`Extracted filename: ${filename}`);

        // Check if file exists
        const coverDir = path.join(process.cwd(), 'uploads', 'covers');
        const filePath = path.join(coverDir, filename);

        console.log(`Expected file path: ${filePath}`);

        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);
          console.log(`✅ File exists! Size: ${stats.size} bytes`);
        } catch (error) {
          console.log(`❌ File does not exist at: ${filePath}`);
          console.log(`Error: ${error.message}`);

          // Check precanned
          const precannedPath = path.join(
            process.cwd(),
            'public',
            'uploads',
            'precanned',
            'uploads',
            filename
          );
          console.log(`\nChecking precanned path: ${precannedPath}`);
          try {
            await fs.access(precannedPath);
            const stats = await fs.stat(precannedPath);
            console.log(`✅ File exists in precanned! Size: ${stats.size} bytes`);
          } catch {
            console.log(`❌ File not in precanned either`);
          }
        }
      } else {
        console.log(`URL format not recognized: ${book.coverImageUrl}`);
      }
    }
  } else {
    // List all books with covers
    const allBooks = await db
      .select({
        id: books.id,
        title: books.title,
        coverImageUrl: books.coverImageUrl,
      })
      .from(books)
      .limit(20);

    console.log(`Found ${allBooks.length} books:\n`);

    for (const book of allBooks) {
      console.log(`- ${book.title}`);
      console.log(`  ID: ${book.id}`);
      console.log(`  Cover URL: ${book.coverImageUrl || '(none)'}`);

      if (book.coverImageUrl) {
        const urlMatch = book.coverImageUrl.match(/\/api\/covers\/(.+)$/);
        if (urlMatch) {
          const filename = urlMatch[1];
          const filePath = path.join(process.cwd(), 'uploads', 'covers', filename);
          try {
            await fs.access(filePath);
            console.log(`  ✅ File exists`);
          } catch {
            console.log(`  ❌ File missing`);
          }
        }
      }
      console.log('');
    }
  }

  // Check covers directory
  console.log('\n=== Checking covers directory ===');
  const coverDir = path.join(process.cwd(), 'uploads', 'covers');
  try {
    const files = await fs.readdir(coverDir);
    console.log(`Directory exists: ${coverDir}`);
    console.log(`Files in directory: ${files.length}`);
    if (files.length > 0) {
      console.log(`First 5 files: ${files.slice(0, 5).join(', ')}`);
    }
  } catch (error) {
    console.log(`❌ Directory does not exist: ${coverDir}`);
    console.log(`Error: ${error.message}`);
  }

  process.exit(0);
}

debugCovers().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});



