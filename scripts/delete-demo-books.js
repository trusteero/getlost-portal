#!/usr/bin/env node

/**
 * Script to delete demo books while respecting foreign key constraints
 * Deletes in proper order: reports -> book_versions -> books
 */

import Database from "better-sqlite3";

let dbPath = process.env.DATABASE_URL || './dev.db';
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

const db = new Database(dbPath);

try {
  // Get demo books (excluding system book)
  const demoBooks = db.prepare('SELECT id, title FROM getlostportal_book WHERE title != ?').all('SYSTEM_SEEDED_REPORTS');
  
  console.log(`Found ${demoBooks.length} demo book(s) to delete\n`);
  
  let deletedCount = 0;
  
  for (const book of demoBooks) {
    console.log(`Deleting: ${book.title}`);
    
    // Get all versions for this book
    const versions = db.prepare('SELECT id FROM getlostportal_book_version WHERE bookId = ?').all(book.id);
    
    for (const version of versions) {
      // Delete reports for this version
      const deletedReports = db.prepare('DELETE FROM getlostportal_report WHERE bookVersionId = ?').run(version.id);
      console.log(`  - Deleted ${deletedReports.changes} report(s)`);
      
      // Delete book features
      const deletedFeatures = db.prepare('DELETE FROM getlostportal_book_feature WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedFeatures.changes} feature(s)`);
      
      // Delete marketing assets
      const deletedAssets = db.prepare('DELETE FROM getlostportal_marketing_asset WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedAssets.changes} marketing asset(s)`);
      
      // Delete book covers
      const deletedCovers = db.prepare('DELETE FROM getlostportal_book_cover WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedCovers.changes} cover(s)`);
      
      // Delete landing pages
      const deletedLanding = db.prepare('DELETE FROM getlostportal_landing_page WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedLanding.changes} landing page(s)`);
      
      // Delete purchases
      const deletedPurchases = db.prepare('DELETE FROM getlostportal_purchase WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedPurchases.changes} purchase(s)`);
      
      // Delete digest jobs
      const deletedDigests = db.prepare('DELETE FROM getlostportal_digest_job WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedDigests.changes} digest job(s)`);
      
      // Delete summaries
      const deletedSummaries = db.prepare('DELETE FROM getlostportal_summary WHERE bookId = ?').run(book.id);
      console.log(`  - Deleted ${deletedSummaries.changes} summary(ies)`);
    }
    
    // Delete book versions
    const deletedVersions = db.prepare('DELETE FROM getlostportal_book_version WHERE bookId = ?').run(book.id);
    console.log(`  - Deleted ${deletedVersions.changes} version(s)`);
    
    // Finally delete the book
    db.prepare('DELETE FROM getlostportal_book WHERE id = ?').run(book.id);
    console.log(`  ✅ Deleted book\n`);
    
    deletedCount++;
  }
  
  console.log(`--- Summary ---`);
  console.log(`✅ Deleted ${deletedCount} demo book(s)`);
  console.log(`📚 System book preserved`);
  
} finally {
  db.close();
}

