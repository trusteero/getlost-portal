#!/usr/bin/env node

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PRECANNED_ROOT = path.resolve(ROOT_DIR, "precannedcontent");
const PUBLIC_PRECANNED_DIR = path.resolve(ROOT_DIR, "public", "uploads", "precanned");

let dbPath = process.env.DATABASE_URL || path.resolve(ROOT_DIR, "dev.db");
if (dbPath.startsWith("file://")) {
  dbPath = dbPath.replace(/^file:\/\//, "");
} else if (dbPath.startsWith("file:")) {
  dbPath = dbPath.replace(/^file:/, "");
}
const DATABASE_PATH = dbPath;

const nowSeconds = () => Math.floor(Date.now() / 1000);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureDatabaseDirectory() {
  const dbDir = path.dirname(DATABASE_PATH);
  try {
    await fs.access(dbDir);
  } catch {
    await fs.mkdir(dbDir, { recursive: true });
  }
}

function getOrCreateSystemBookAndVersion(db) {
  let systemBook = db
    .prepare(`SELECT id FROM getlostportal_book WHERE title = 'SYSTEM_SEEDED_REPORTS' LIMIT 1`)
    .get();

  if (!systemBook) {
    let user = db.prepare(`SELECT id FROM getlostportal_user LIMIT 1`).get();
    if (!user) {
      const systemUserId = randomUUID();
      db.prepare(
        `INSERT INTO getlostportal_user (id, email, name, role, emailVerified, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        systemUserId,
        "system@getlost.com",
        "System",
        "admin",
        nowSeconds(),
        nowSeconds(),
        nowSeconds()
      );
      user = { id: systemUserId };
    }

    const bookId = randomUUID();
    db.prepare(
      `INSERT INTO getlostportal_book (id, userId, title, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      bookId,
      user.id,
      "SYSTEM_SEEDED_REPORTS",
      "System book for precanned assets",
      nowSeconds(),
      nowSeconds()
    );
    systemBook = { id: bookId };
  }

  let systemVersion = db
    .prepare(
      `SELECT id FROM getlostportal_book_version
       WHERE bookId = ? AND fileName = 'SYSTEM_SEEDED_VERSION'
       LIMIT 1`
    )
    .get(systemBook.id);

  if (!systemVersion) {
    const versionId = randomUUID();
    db.prepare(
      `INSERT INTO getlostportal_book_version
        (id, bookId, versionNumber, fileName, fileUrl, fileSize, fileType, mimeType, uploadedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      versionId,
      systemBook.id,
      1,
      "SYSTEM_SEEDED_VERSION",
      "/system/seeded",
      0,
      "system",
      "application/system",
      nowSeconds()
    );
    systemVersion = { id: versionId };
  }

  return { systemBookId: systemBook.id, systemVersionId: systemVersion.id };
}

async function bundleHtmlInline(htmlFilePath, htmlContent) {
  const reportDir = path.dirname(htmlFilePath);
  const imageRegex =
    /(src|href)\s*=\s*["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']|background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
  const matches = Array.from(htmlContent.matchAll(imageRegex));

  let bundledHtml = htmlContent;
  const processedImages = new Set();

  for (const match of matches) {
    const imagePath = match[2] || match[4] || match[5];
    if (
      !imagePath ||
      processedImages.has(imagePath) ||
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://") ||
      imagePath.startsWith("data:")
    ) {
      continue;
    }

    const candidatePaths = [
      path.resolve(reportDir, imagePath),
      path.resolve(path.dirname(reportDir), imagePath)
    ];

    const subDirs = await fs.readdir(reportDir, { withFileTypes: true });
    for (const entry of subDirs) {
      if (entry.isDirectory()) {
        candidatePaths.push(path.resolve(reportDir, entry.name, imagePath));
      }
    }

    let resolvedImagePath = null;
    for (const candidate of candidatePaths) {
      try {
        await fs.access(candidate);
        resolvedImagePath = candidate;
        break;
      } catch {
        // continue
      }
    }

    if (!resolvedImagePath) {
      console.warn(`  ⚠️  Could not find image referenced in HTML: ${imagePath}`);
      continue;
    }

    const imageBuffer = await fs.readFile(resolvedImagePath);
    const ext = path.extname(resolvedImagePath).toLowerCase();
    let mimeType = "image/jpeg";
    switch (ext) {
      case ".png":
        mimeType = "image/png";
        break;
      case ".gif":
        mimeType = "image/gif";
        break;
      case ".webp":
        mimeType = "image/webp";
        break;
      case ".svg":
        mimeType = "image/svg+xml";
        break;
      case ".jpg":
      case ".jpeg":
      default:
        mimeType = "image/jpeg";
    }

    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    const escaped = imagePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`src=["']${escaped}["']`, "gi"),
      new RegExp(`href=["']${escaped}["']`, "gi"),
      new RegExp(`background-image:\\s*url\\(["']?${escaped}["']?\\)`, "gi"),
      new RegExp(`url\\(["']?${escaped}["']?\\)`, "gi")
    ];

    for (const pattern of patterns) {
      bundledHtml = bundledHtml.replace(pattern, (matchText) => matchText.replace(imagePath, dataUrl));
    }

    processedImages.add(imagePath);
  }

  return bundledHtml;
}

function extractCoverImageData(htmlContent) {
  if (!htmlContent) return null;
  const match = htmlContent.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
  return match ? match[1] : null;
}

async function readHtmlFile(relativePath) {
  const absolutePath = path.resolve(PRECANNED_ROOT, relativePath);
  const htmlBuffer = await fs.readFile(absolutePath);
  return bundleHtmlInline(absolutePath, htmlBuffer.toString("utf-8"));
}

async function copyAsset(relativePath, destSegments) {
  const sourcePath = path.resolve(PRECANNED_ROOT, relativePath);
  await fs.access(sourcePath);
  const destinationDir = path.join(PUBLIC_PRECANNED_DIR, ...destSegments.slice(0, -1));
  await ensureDir(destinationDir);
  const destinationPath = path.join(destinationDir, destSegments[destSegments.length - 1]);
  await fs.copyFile(sourcePath, destinationPath);
  const publicPath = "/uploads/precanned/" + destSegments.map((segment) => segment.replace(/\\/g, "/")).join("/");
  return { fileUrl: publicPath, destinationPath };
}

function cleanupExistingSeededData(db) {
  db.prepare(`DELETE FROM getlostportal_report WHERE adminNotes LIKE '%"precanned":true%'`).run();
  db.prepare(`DELETE FROM getlostportal_marketing_asset WHERE metadata LIKE '%"precanned":true%'`).run();
  db.prepare(`DELETE FROM getlostportal_book_cover WHERE metadata LIKE '%"precanned":true%'`).run();
  db.prepare(`DELETE FROM getlostportal_landing_page WHERE metadata LIKE '%"precanned":true%'`).run();
}

async function seedReports(db, book, systemVersionId) {
  if (!book.report || !book.preview) {
    console.warn(`⚠️  Skipping reports for ${book.key} (missing preview or report path)`);
    return;
  }

  const uploadFileNames = Array.isArray(book.uploadFileNames) && book.uploadFileNames.length > 0
    ? book.uploadFileNames
    : [path.basename(book.report)];

  const previewHtml = await readHtmlFile(book.preview);
  const reportHtml = await readHtmlFile(book.report);
  const previewCoverData = extractCoverImageData(previewHtml);
  const reportCoverData = extractCoverImageData(reportHtml);

  const baseNotes = {
    precanned: true,
    precannedKey: book.key,
    uploadFileNames
  };

  const reportValues = [
    {
      id: randomUUID(),
      status: "preview",
      html: previewHtml,
      notes: JSON.stringify({
        ...baseNotes,
        variant: "preview",
        seededFileName: path.basename(book.preview),
        sourcePath: book.preview,
        coverImageData: previewCoverData
      })
    },
    {
      id: randomUUID(),
      status: "completed",
      html: reportHtml,
      notes: JSON.stringify({
        ...baseNotes,
        variant: "report",
        seededFileName: path.basename(book.report),
        sourcePath: book.report,
        coverImageData: reportCoverData
      })
    }
  ];

  for (const record of reportValues) {
    db.prepare(
      `INSERT INTO getlostportal_report
        (id, bookVersionId, status, htmlContent, adminNotes, requestedAt, completedAt, analyzedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      systemVersionId,
      record.status,
      record.html,
      record.notes,
      nowSeconds(),
      nowSeconds(),
      "system@getlost.com"
    );
  }

  console.log(`  ✅ Seeded preview + report for ${book.key}`);
}

async function seedLandingPage(db, book, systemBookId) {
  if (!book.landingPage?.file) {
    console.warn(`⚠️  Skipping landing page for ${book.key} (missing file path)`);
    return;
  }

  const htmlContent = await readHtmlFile(book.landingPage.file);
  const slug = book.landingPage.slug || `${slugify(book.key)}-landing`;
  const metadata = {
    precanned: true,
    precannedKey: book.key,
    uploadFileNames: book.uploadFileNames || [],
    sourcePath: book.landingPage.file
  };

  db.prepare(
    `INSERT INTO getlostportal_landing_page
      (id, bookId, slug, title, headline, subheadline, description, htmlContent, metadata, status, isPublished, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    systemBookId,
    slug,
    book.landingPage.title || book.title,
    book.landingPage.headline || book.landingPage.title || book.title,
    book.landingPage.subheadline || book.landingPage.description || "",
    book.landingPage.description || "",
    htmlContent,
    JSON.stringify(metadata),
    "published",
    1,
    nowSeconds(),
    nowSeconds()
  );

  console.log(`  ✅ Seeded landing page for ${book.key}`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteAssetReferences(html, replacements) {
  let output = html;
  for (const [search, replacement] of replacements.entries()) {
    if (!search || !replacement) continue;
    output = output.replace(new RegExp(escapeRegex(search), "g"), replacement);
  }
  return output;
}

async function seedMarketingAssets(db, book, systemBookId) {
  const assetReplacements = new Map();

  if (!Array.isArray(book.videos) || book.videos.length === 0) {
    console.warn(`⚠️  Skipping marketing assets for ${book.key} (no videos provided)`);
  } else {
    let index = 0;
    for (const video of book.videos) {
      index += 1;
      if (!video.file) continue;

      const parsedName = path.parse(video.file);
      const baseName = parsedName.name || `clip-${index}`;
      const ext = parsedName.ext || ".mp4";
      const slug = `${slugify(book.key)}-${slugify(baseName)}${ext}`;
      const { fileUrl } = await copyAsset(video.file, [book.key, "videos", slug]);

      assetReplacements.set(video.file, fileUrl);
      assetReplacements.set(path.basename(video.file), fileUrl);

      let thumbnailUrl = null;
      if (video.poster) {
        const posterParsed = path.parse(video.poster);
        const posterExt = posterParsed.ext || ".png";
        const posterSlug = `${slugify(book.key)}-${slugify(posterParsed.name || `${baseName}-poster`)}${posterExt}`;
        const posterCopy = await copyAsset(video.poster, [book.key, "videos", posterSlug]);
        thumbnailUrl = posterCopy.fileUrl;

        assetReplacements.set(video.poster, posterCopy.fileUrl);
        assetReplacements.set(path.basename(video.poster), posterCopy.fileUrl);
      }

      const metadata = {
        precanned: true,
        precannedKey: book.key,
        variant: "video",
        uploadFileNames: book.uploadFileNames || [],
        sourceFile: video.file,
        posterFile: video.poster || null
      };

      db.prepare(
        `INSERT INTO getlostportal_marketing_asset
          (id, bookId, assetType, title, description, fileUrl, thumbnailUrl, metadata, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        systemBookId,
        "video",
        video.title || `${book.title} Clip ${index}`,
        video.description || "",
        fileUrl,
        thumbnailUrl,
        JSON.stringify(metadata),
        "completed",
        nowSeconds(),
        nowSeconds()
      );
    }
  }

  if (book.marketingHtml) {
    try {
      const marketingHtml = await readHtmlFile(book.marketingHtml);
      const adjustedHtml = rewriteAssetReferences(marketingHtml, assetReplacements);
      const metadata = {
        precanned: true,
        precannedKey: book.key,
        variant: "html",
        htmlContent: adjustedHtml,
        sourceFile: book.marketingHtml,
        uploadFileNames: book.uploadFileNames || []
      };

      db.prepare(
        `INSERT INTO getlostportal_marketing_asset
          (id, bookId, assetType, title, description, fileUrl, thumbnailUrl, metadata, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        systemBookId,
        "html",
        `${book.title} Marketing Toolkit`,
        "Interactive marketing toolkit preview",
        "",
        "",
        JSON.stringify(metadata),
        "completed",
        nowSeconds(),
        nowSeconds()
      );
      console.log(`  ✅ Added marketing HTML experience for ${book.key}`);
    } catch (error) {
      console.warn(`  ⚠️  Failed to bundle marketing HTML for ${book.key}:`, error.message);
    }
  }
  console.log(`  ✅ Seeded marketing assets for ${book.key}`);
}

async function seedCovers(db, book, systemBookId) {
  const coverReplacements = new Map();

  if (!Array.isArray(book.covers) || book.covers.length === 0) {
    console.warn(`⚠️  No cover image files provided for ${book.key}`);
  } else {
    let order = 0;
    for (const cover of book.covers) {
      order += 1;
      if (!cover.file) continue;
      const ext = path.extname(cover.file) || ".png";
      const slug = `${slugify(book.key)}-${slugify(path.parse(cover.file).name || `cover-${order}`)}${ext}`;
      const { fileUrl } = await copyAsset(cover.file, [book.key, "covers", slug]);

      coverReplacements.set(cover.file, fileUrl);
      coverReplacements.set(path.basename(cover.file), fileUrl);

      const metadata = {
        precanned: true,
        precannedKey: book.key,
        uploadFileNames: book.uploadFileNames || [],
        sourceFile: cover.file,
        order
      };

      db.prepare(
        `INSERT INTO getlostportal_book_cover
          (id, bookId, coverType, title, imageUrl, metadata, isPrimary, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        systemBookId,
        cover.coverType || "ebook",
        cover.title || `${book.title} Cover ${order}`,
        fileUrl,
        JSON.stringify(metadata),
        cover.isPrimary ? 1 : 0,
        "completed",
        nowSeconds(),
        nowSeconds()
      );
    }
  }

  if (book.coversHtml) {
    try {
      const coverHtml = await readHtmlFile(book.coversHtml);
      const adjustedHtml = rewriteAssetReferences(coverHtml, coverReplacements);
      const metadata = {
        precanned: true,
        precannedKey: book.key,
        variant: "html",
        htmlContent: adjustedHtml,
        uploadFileNames: book.uploadFileNames || [],
        sourceFile: book.coversHtml
      };

      db.prepare(
        `INSERT INTO getlostportal_book_cover
          (id, bookId, coverType, title, imageUrl, metadata, isPrimary, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        systemBookId,
        "html",
        `${book.title} Cover Gallery`,
        "",
        JSON.stringify(metadata),
        0,
        "completed",
        nowSeconds(),
        nowSeconds()
      );
      console.log(`  ✅ Added cover HTML experience for ${book.key}`);
    } catch (error) {
      console.warn(`  ⚠️  Failed to bundle covers HTML for ${book.key}:`, error.message);
    }
  }

  console.log(`  ✅ Seeded covers for ${book.key}`);
}

async function main() {
  console.log(`\n📦 Seeding precanned content from ${PRECANNED_ROOT}`);
  await ensureDatabaseDirectory();
  await ensureDir(PUBLIC_PRECANNED_DIR);

  const manifestPath = path.resolve(PRECANNED_ROOT, "manifest.json");
  const manifestRaw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);
  const precannedBooks = Array.isArray(manifest?.books) ? manifest.books : [];

  const db = new Database(DATABASE_PATH);
  console.log(`Connected to database: ${DATABASE_PATH}`);

  try {
    cleanupExistingSeededData(db);
    const { systemBookId, systemVersionId } = getOrCreateSystemBookAndVersion(db);
    console.log(`Using system book ${systemBookId} (version ${systemVersionId})\n`);

    for (const book of precannedBooks) {
      console.log(`➡️  Processing ${book.title || book.key}`);
      try {
        await seedReports(db, book, systemVersionId);
        await seedLandingPage(db, book, systemBookId);
        await seedMarketingAssets(db, book, systemBookId);
        await seedCovers(db, book, systemBookId);
        console.log("");
      } catch (error) {
        console.error(`  ❌ Failed to seed ${book.key}:`, error.message);
        console.error("");
      }
    }

    console.log("✅ Precanned content seeding complete.\n");
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error("Failed to seed precanned content:", error);
  process.exit(1);
});

