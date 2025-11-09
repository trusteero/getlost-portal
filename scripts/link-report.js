#!/usr/bin/env node

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('./dev.db');

function normalizeFilename(filename) {
  let normalized = filename.toLowerCase().replace(/\.[^.]*$/, '');
  normalized = normalized
    .replace(/\s*(final|book|report|manuscript|draft|version)\s*/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
  return normalized;
}

function extractCoreName(filename) {
  const normalized = normalizeFilename(filename);
  const words = normalized.match(/[a-z]{3,}/g) || [];
  if (words.length > 0) {
    const longestWord = words.reduce((a, b) => a.length > b.length ? a : b);
    return longestWord;
  }
  return normalized;
}

// Get the latest user book
const book = db.prepare('SELECT id FROM getlostportal_book WHERE title != ? ORDER BY createdAt DESC LIMIT 1').get('SYSTEM_SEEDED_REPORTS');

if (!book) {
  console.log('No user book found');
  process.exit(1);
}

const version = db.prepare('SELECT id, fileName FROM getlostportal_book_version WHERE bookId = ? LIMIT 1').get(book.id);

if (!version) {
  console.log('No version found for book');
  process.exit(1);
}

console.log('Book version:', version.fileName);

// Get system book and seeded reports
const systemBook = db.prepare('SELECT id FROM getlostportal_book WHERE title = ?').get('SYSTEM_SEEDED_REPORTS');

if (!systemBook) {
  console.log('No system book found');
  process.exit(1);
}

const systemVersions = db.prepare('SELECT id FROM getlostportal_book_version WHERE bookId = ?').all(systemBook.id);
const versionIds = systemVersions.map(v => v.id);

if (versionIds.length === 0) {
  console.log('No system versions found');
  process.exit(1);
}

const seededReports = db.prepare(
  `SELECT id, status, htmlContent, pdfUrl, adminNotes, requestedAt, completedAt, analyzedBy 
   FROM getlostportal_report 
   WHERE bookVersionId IN (${versionIds.map(() => '?').join(',')}) 
   AND adminNotes IS NOT NULL`
).all(...versionIds);

console.log(`Found ${seededReports.length} seeded reports`);

const uploadedCore = extractCoreName(version.fileName);
const uploadedNorm = normalizeFilename(version.fileName);

console.log(`Looking for match: ${version.fileName}`);
console.log(`  Normalized: ${uploadedNorm}`);
console.log(`  Core: ${uploadedCore}`);

for (const report of seededReports) {
  try {
    const notes = JSON.parse(report.adminNotes || '{}');
    if (notes.seededFileName) {
      const seededCore = extractCoreName(notes.seededFileName);
      const seededNorm = normalizeFilename(notes.seededFileName);
      
      const match = 
        seededNorm === uploadedNorm ||
        seededNorm.includes(uploadedNorm) ||
        uploadedNorm.includes(seededNorm) ||
        seededCore === uploadedCore ||
        seededCore.includes(uploadedCore) ||
        uploadedCore.includes(seededCore);
      
      console.log(`  Checking: ${notes.seededFileName}`);
      console.log(`    Normalized: ${seededNorm}, Core: ${seededCore}, Match: ${match}`);
      
      if (match) {
        const newReportId = randomUUID();
        db.prepare(
          `INSERT INTO getlostportal_report 
           (id, bookVersionId, status, htmlContent, pdfUrl, adminNotes, requestedAt, completedAt, analyzedBy) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          newReportId,
          version.id,
          report.status,
          report.htmlContent,
          report.pdfUrl,
          report.adminNotes,
          report.requestedAt,
          report.completedAt,
          report.analyzedBy
        );
        console.log(`  ✓ Linked report: ${newReportId}`);
        break;
      }
    }
  } catch (e) {
    console.log(`  Error parsing notes: ${e.message}`);
  }
}

db.close();

