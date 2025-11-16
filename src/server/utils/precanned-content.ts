import { promises as fs } from "fs";
import path from "path";
import { db } from "@/server/db";
import {
  reports,
  marketingAssets,
  bookCovers,
  landingPages,
} from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

type PrecannedManifest = {
  books: PrecannedManifestBook[];
};

export type PrecannedManifestBook = {
  key: string;
  title: string;
  uploadFileNames?: string[];
  report?: string;
  preview?: string;
  landingPage?: {
    file: string;
    slug?: string;
    title?: string;
    description?: string;
    headline?: string;
    subheadline?: string;
  };
  marketingHtml?: string;
  coversHtml?: string;
  videos?: Array<{
    file: string;
    title?: string;
    description?: string;
    poster?: string;
  }>;
  covers?: Array<{
    file: string;
    title?: string;
    coverType?: string;
    isPrimary?: boolean;
  }>;
};

export type ImportFeatureFlags = {
  reports?: boolean;
  marketing?: boolean;
  covers?: boolean;
  landingPage?: boolean;
};

export type ImportPrecannedResult = {
  packageKey: string;
  reportsLinked: number;
  marketingAssetsLinked: number;
  coversLinked: number;
  landingPageLinked: boolean;
  primaryCoverImageUrl: string | null;
};

const PRECANNED_ROOT = path.resolve(process.cwd(), "precannedcontent");
const PRECANNED_PUBLIC_ROOT = path.resolve(process.cwd(), "public", "uploads", "precanned");
const PRECANNED_MANIFEST_PATH = path.resolve(PRECANNED_ROOT, "manifest.json");

let manifestCache: PrecannedManifest | null = null;
const copiedAssetPaths = new Set<string>();
let precannedUploadImagesCache: string[] | null = null;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const normalizeFilename = (filename: string) => {
  let normalized = filename.toLowerCase().replace(/\.[^.]*$/, "");
  normalized = normalized
    .replace(/\s*(final|book|report|manuscript|draft|version|copy)\s*/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
  return normalized;
};

const extractCoreName = (filename: string) => {
  const normalized = normalizeFilename(filename);
  const words = normalized.match(/[a-z]{3,}/g) || [];
  if (words.length === 0) {
    return normalized;
  }
  return words.reduce((a, b) => (a.length >= b.length ? a : b));
};

const filenamesMatch = (candidate: string, uploaded: string) => {
  const seededNormalized = normalizeFilename(candidate);
  const seededCore = extractCoreName(candidate);
  const uploadedNormalized = normalizeFilename(uploaded);
  const uploadedCore = extractCoreName(uploaded);

  return (
    seededNormalized === uploadedNormalized ||
    seededNormalized.includes(uploadedNormalized) ||
    uploadedNormalized.includes(seededNormalized) ||
    seededCore === uploadedCore ||
    seededCore.includes(uploadedCore) ||
    uploadedCore.includes(seededCore)
  );
};

async function loadManifest(): Promise<PrecannedManifest> {
  if (manifestCache) {
    return manifestCache;
  }

  const raw = await fs.readFile(PRECANNED_MANIFEST_PATH, "utf-8");
  const parsed: PrecannedManifest = JSON.parse(raw);
  manifestCache = parsed;
  return parsed;
}

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyPrecannedAsset(relativePath: string, destSegments: string[]) {
  const sourcePath = path.resolve(PRECANNED_ROOT, relativePath);
  if (!destSegments || destSegments.length === 0) {
    throw new Error("copyPrecannedAsset: 'destSegments' must be a non-empty array");
  }
  const destinationDir = path.join(PRECANNED_PUBLIC_ROOT, ...destSegments.slice(0, - 1));
  await ensureDirectory(destinationDir);
  const fileName = destSegments[destSegments.length - 1]!;
  const destinationPath = path.join(destinationDir, fileName);

  if (!copiedAssetPaths.has(destinationPath)) {
    await fs.copyFile(sourcePath, destinationPath);
    copiedAssetPaths.add(destinationPath);
  }

  const publicPath =
    "/uploads/precanned/" + destSegments.map((segment) => segment.replace(/\\/g, "/")).join("/");

  return { fileUrl: publicPath, destinationPath };
}

async function listPrecannedUploadImages(): Promise<string[]> {
  if (precannedUploadImagesCache) {
    return precannedUploadImagesCache;
  }

  const uploadsDir = path.resolve(PRECANNED_ROOT, "uploads");
  let entries: Array<string> = [];

  try {
    const dirEntries = await fs.readdir(uploadsDir, { withFileTypes: true });
    entries = dirEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    // If the uploads directory doesn't exist, just return empty
    precannedUploadImagesCache = [];
    return precannedUploadImagesCache;
  }

  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
  precannedUploadImagesCache = entries.filter((name) =>
    imageExtensions.has(path.extname(name).toLowerCase()),
  );

  return precannedUploadImagesCache;
}

async function bundleHtmlInline(htmlFilePath: string, htmlContent: string) {
  const reportDir = path.dirname(htmlFilePath);
  const imageRegex =
    /(src|href)\s*=\s*["']([^"']+\.(jpg|jpeg|png|gif|webp|svg))["']|background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
  const matches = Array.from(htmlContent.matchAll(imageRegex));

  let bundledHtml = htmlContent;
  const processedImages = new Set<string>();

  for (const match of matches) {
    const imagePath = match[2] || match[4];
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
      path.resolve(path.dirname(reportDir), imagePath),
    ];

    const subDirs = await fs.readdir(reportDir, { withFileTypes: true });
    for (const entry of subDirs) {
      if (entry.isDirectory()) {
        candidatePaths.push(path.resolve(reportDir, entry.name, imagePath));
      }
    }

    let resolvedImagePath: string | null = null;
    for (const candidate of candidatePaths) {
      try {
        await fs.access(candidate);
        resolvedImagePath = candidate;
        break;
      } catch {
        continue;
      }
    }

    if (!resolvedImagePath) {
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
      default:
        mimeType = "image/jpeg";
    }

    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    const escaped = imagePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`src=["']${escaped}["']`, "gi"),
      new RegExp(`href=["']${escaped}["']`, "gi"),
      new RegExp(`background-image:\\s*url\\(["']?${escaped}["']?\\)`, "gi"),
      new RegExp(`url\\(["']?${escaped}["']?\\)`, "gi"),
    ];

    for (const pattern of patterns) {
      bundledHtml = bundledHtml.replace(pattern, (matchText) => matchText.replace(imagePath, dataUrl));
    }

    processedImages.add(imagePath);
  }

  return bundledHtml;
}

const extractCoverImageData = (htmlContent: string | null) => {
  if (!htmlContent) return null;
  const match = htmlContent.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
  return match ? match[1] : null;
};

async function readHtmlFile(relativePath?: string) {
  if (!relativePath) return null;
  const absolutePath = path.resolve(PRECANNED_ROOT, relativePath);
  const htmlBuffer = await fs.readFile(absolutePath);
  return bundleHtmlInline(absolutePath, htmlBuffer.toString("utf-8"));
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rewriteAssetReferences = (html: string, replacements: Map<string, string>) => {
  let output = html;
  for (const [search, replacement] of replacements.entries()) {
    if (!search || !replacement) continue;
    // Replace full path matches
    output = output.replace(new RegExp(escapeRegex(search), "g"), replacement);
    // Also replace just the filename (for relative paths in HTML)
    const filename = path.basename(search);
    if (filename !== search) {
      // Replace relative paths like src="Video1.mp4" with the full URL
      const filenameRegex = new RegExp(`(["'])([^"']*${escapeRegex(filename)})["']`, "gi");
      output = output.replace(filenameRegex, (match, quote, pathPart) => {
        // Only replace if it's a relative path (doesn't start with http/https/data)
        if (!pathPart.startsWith("http://") && !pathPart.startsWith("https://") && !pathPart.startsWith("data:")) {
          return `${quote}${replacement}${quote}`;
        }
        return match;
      });
    }
  }
  return output;
};

async function ensureUniqueLandingSlug(baseSlug: string, bookId: string) {
  const safeBase = baseSlug || `landing-${bookId.slice(0, 8)}`;
  let attempt = 0;
  let candidate = safeBase;

  while (true) {
    const existing = await db
      .select({ id: landingPages.id })
      .from(landingPages)
      .where(eq(landingPages.slug, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }

    attempt += 1;
    const suffix = `${bookId.slice(0, 8)}${attempt > 1 ? `-${attempt}` : ""}`;
    candidate = slugify(`${safeBase}-${suffix}`).slice(0, 120);
  }
}

async function deleteExistingPrecannedRows(table: typeof reports | typeof marketingAssets | typeof bookCovers | typeof landingPages, conditions: any[]) {
  await db
    .delete(table)
    .where(and(...conditions));
}

async function importReportsFromPackage(bookVersionId: string, pkg: PrecannedManifestBook) {
  if (!pkg.report || !pkg.preview) {
    return 0;
  }

  await deleteExistingPrecannedRows(reports, [
    eq(reports.bookVersionId, bookVersionId),
    sql`${reports.adminNotes} IS NOT NULL AND ${reports.adminNotes} LIKE ${`%"precannedKey":"${pkg.key}"%`}`,
  ]);

  const [previewHtml, reportHtml] = await Promise.all([
    readHtmlFile(pkg.preview),
    readHtmlFile(pkg.report),
  ]);

  if (!previewHtml || !reportHtml) {
    return 0;
  }

  const timestamp = new Date();
  const baseNotes = {
    precanned: true,
    precannedKey: pkg.key,
    uploadFileNames: pkg.uploadFileNames || [],
  };

  await db.insert(reports).values({
    id: randomUUID(),
    bookVersionId,
    status: "preview",
    htmlContent: previewHtml,
    adminNotes: JSON.stringify({
      ...baseNotes,
      variant: "preview",
      seededFileName: path.basename(pkg.preview),
      sourcePath: pkg.preview,
      coverImageData: extractCoverImageData(previewHtml),
    }),
    requestedAt: timestamp,
    completedAt: timestamp,
    analyzedBy: "system@getlost.com",
  });

  await db.insert(reports).values({
    id: randomUUID(),
    bookVersionId,
    status: "completed",
    htmlContent: reportHtml,
    adminNotes: JSON.stringify({
      ...baseNotes,
      variant: "report",
      seededFileName: path.basename(pkg.report),
      sourcePath: pkg.report,
      coverImageData: extractCoverImageData(reportHtml),
    }),
    requestedAt: timestamp,
    completedAt: timestamp,
    analyzedBy: "system@getlost.com",
  });

  return 2;
}

async function importMarketingAssetsFromPackage(bookId: string, pkg: PrecannedManifestBook) {
  await deleteExistingPrecannedRows(marketingAssets, [
    eq(marketingAssets.bookId, bookId),
    sql`${marketingAssets.metadata} IS NOT NULL AND ${marketingAssets.metadata} LIKE ${`%"precannedKey":"${pkg.key}"%`}`,
  ]);

  const assetReplacements = new Map<string, string>();
  let created = 0;

  if (Array.isArray(pkg.videos)) {
    let index = 0;
    for (const video of pkg.videos) {
      if (!video.file) continue;
      index += 1;
      const parsedName = path.parse(video.file);
      const baseName = parsedName.name || `clip-${index}`;
      const ext = parsedName.ext || ".mp4";
      const slug = `${slugify(pkg.key)}-${slugify(baseName)}${ext}`;
      const { fileUrl } = await copyPrecannedAsset(video.file, [pkg.key, "videos", slug]);
      // Map both full path and just the filename for replacement
      assetReplacements.set(video.file, fileUrl);
      const videoBasename = path.basename(video.file);
      assetReplacements.set(videoBasename, fileUrl);

      let thumbnailUrl: string | null = null;
      if (video.poster) {
        const posterParsed = path.parse(video.poster);
        const posterExt = posterParsed.ext || ".png";
        const posterSlug = `${slugify(pkg.key)}-${slugify(posterParsed.name || `${baseName}-poster`)}${posterExt}`;
        const posterCopy = await copyPrecannedAsset(video.poster, [pkg.key, "videos", posterSlug]);
        thumbnailUrl = posterCopy.fileUrl;
        // Map both full path and just the filename for replacement
        assetReplacements.set(video.poster, posterCopy.fileUrl);
        assetReplacements.set(path.basename(video.poster), posterCopy.fileUrl);
        // Also map the original poster filename (e.g., "Wool UI.png") to the new URL
        const originalPosterFilename = path.basename(video.poster);
        assetReplacements.set(originalPosterFilename, posterCopy.fileUrl);
        // Handle relative paths like "Landing page/Wool UI.png"
        const posterRelativePath = video.poster.replace(/^[^/]+\//, "");
        if (posterRelativePath !== video.poster) {
          assetReplacements.set(posterRelativePath, posterCopy.fileUrl);
        }
      }

      await db.insert(marketingAssets).values({
        id: randomUUID(),
        bookId,
        assetType: "video",
        title: video.title || `${pkg.title} Clip ${index}`,
        description: video.description || "",
        fileUrl,
        thumbnailUrl,
        metadata: JSON.stringify({
          precanned: true,
          precannedKey: pkg.key,
          sourceFile: video.file,
          posterFile: video.poster || null,
          uploadFileNames: pkg.uploadFileNames || [],
        }),
        status: "completed",
      });
      created += 1;
    }
  }

  if (pkg.marketingHtml) {
    const rawHtml = await readHtmlFile(pkg.marketingHtml);
    if (rawHtml) {
      const adjustedHtml = rewriteAssetReferences(rawHtml, assetReplacements);
      await db.insert(marketingAssets).values({
        id: randomUUID(),
        bookId,
        assetType: "html",
        title: `${pkg.title} Marketing Toolkit`,
        description: "Interactive marketing toolkit preview",
        fileUrl: "",
        thumbnailUrl: "",
        metadata: JSON.stringify({
          precanned: true,
          precannedKey: pkg.key,
          variant: "html",
          htmlContent: adjustedHtml,
          sourceFile: pkg.marketingHtml,
          uploadFileNames: pkg.uploadFileNames || [],
        }),
        status: "completed",
      });
      created += 1;
    }
  }

  return created;
}

async function importCoversFromPackage(bookId: string, pkg: PrecannedManifestBook) {
  await deleteExistingPrecannedRows(bookCovers, [
    eq(bookCovers.bookId, bookId),
    sql`${bookCovers.metadata} IS NOT NULL AND ${bookCovers.metadata} LIKE ${`%"precannedKey":"${pkg.key}"%`}`,
  ]);

  const coverReplacements = new Map<string, string>();
  let created = 0;
  let primaryCoverUrl: string | null = null;

  if (Array.isArray(pkg.covers)) {
    let order = 0;
    for (const cover of pkg.covers) {
      if (!cover.file) continue;
      order += 1;
      const ext = path.extname(cover.file) || ".png";
      const slug = `${slugify(pkg.key)}-${slugify(path.parse(cover.file).name || `cover-${order}`)}${ext}`;
      const { fileUrl } = await copyPrecannedAsset(cover.file, [pkg.key, "covers", slug]);
      coverReplacements.set(cover.file, fileUrl);
      coverReplacements.set(path.basename(cover.file), fileUrl);

      await db.insert(bookCovers).values({
        id: randomUUID(),
        bookId,
        coverType: cover.coverType || "ebook",
        title: cover.title || `${pkg.title} Cover ${order}`,
        imageUrl: fileUrl,
        thumbnailUrl: fileUrl,
        metadata: JSON.stringify({
          precanned: true,
          precannedKey: pkg.key,
          sourceFile: cover.file,
          uploadFileNames: pkg.uploadFileNames || [],
          order,
        }),
        isPrimary: !!cover.isPrimary,
        status: "completed",
      });
      if (!primaryCoverUrl && cover.isPrimary && fileUrl) {
        primaryCoverUrl = fileUrl;
      }
      created += 1;
    }
  }

  if (pkg.coversHtml) {
    const rawHtml = await readHtmlFile(pkg.coversHtml);
    if (rawHtml) {
      const adjustedHtml = rewriteAssetReferences(rawHtml, coverReplacements);
      await db.insert(bookCovers).values({
        id: randomUUID(),
        bookId,
        coverType: "html",
        title: `${pkg.title} Cover Gallery`,
        imageUrl: "",
        thumbnailUrl: "",
        metadata: JSON.stringify({
          precanned: true,
          precannedKey: pkg.key,
          variant: "html",
          htmlContent: adjustedHtml,
          sourceFile: pkg.coversHtml,
          uploadFileNames: pkg.uploadFileNames || [],
        }),
        isPrimary: false,
        status: "completed",
      });
      created += 1;
    }
  }

  return { created, primaryCoverUrl };
}

async function importLandingPageFromPackage(bookId: string, pkg: PrecannedManifestBook) {
  if (!pkg.landingPage?.file) {
    return false;
  }

  await deleteExistingPrecannedRows(landingPages, [
    eq(landingPages.bookId, bookId),
    sql`${landingPages.metadata} IS NOT NULL AND ${landingPages.metadata} LIKE ${`%"precannedKey":"${pkg.key}"%`}`,
  ]);

  const htmlContent = await readHtmlFile(pkg.landingPage.file);
  if (!htmlContent) {
    return false;
  }

  const baseSlug = pkg.landingPage.slug || `${slugify(pkg.key)}-landing`;
  const slug = await ensureUniqueLandingSlug(slugify(baseSlug), bookId);

  await db.insert(landingPages).values({
    id: randomUUID(),
    bookId,
    slug,
    title: pkg.landingPage.title || pkg.title,
    headline: pkg.landingPage.headline || pkg.landingPage.title || pkg.title,
    subheadline: pkg.landingPage.subheadline || pkg.landingPage.description || "",
    description: pkg.landingPage.description || "",
    htmlContent,
    metadata: JSON.stringify({
      precanned: true,
      precannedKey: pkg.key,
      sourceFile: pkg.landingPage.file,
      uploadFileNames: pkg.uploadFileNames || [],
    }),
    isPublished: true,
    status: "published",
  });

  return true;
}

export async function findPrecannedPackageByFilename(fileName?: string) {
  if (!fileName) {
    return null;
  }
  const manifest = await loadManifest();
  for (const book of manifest.books || []) {
    const candidates = new Set<string>();
    (book.uploadFileNames || []).forEach((name) => name && candidates.add(name));
    if (book.report) {
      candidates.add(path.basename(book.report));
    }
    if (book.preview) {
      candidates.add(path.basename(book.preview));
    }
    if (candidates.size === 0) continue;
    for (const candidate of candidates) {
      if (filenamesMatch(candidate, fileName)) {
        return book;
      }
    }
  }
  return null;
}

/**
 * Find a standalone cover image in precannedcontent/uploads that best matches
 * the given uploaded filename (e.g. BeachRead.pdf -> beach_read.jpg).
 * Returns a public URL (under /uploads/precanned/...) or null.
 */
export async function findPrecannedCoverImageForFilename(
  fileName?: string | null,
): Promise<string | null> {
  if (!fileName) return null;

  const images = await listPrecannedUploadImages();
  for (const imageName of images) {
    if (filenamesMatch(imageName, fileName)) {
      const { fileUrl } = await copyPrecannedAsset(
        path.join("uploads", imageName),
        ["uploads", imageName],
      );
      return fileUrl;
    }
  }

  return null;
}

export async function findPrecannedPackageByKey(key?: string) {
  if (!key) return null;
  const manifest = await loadManifest();
  return manifest.books?.find((book) => book.key === key) ?? null;
}

function resolveFeatureFlags(flags?: ImportFeatureFlags): Required<ImportFeatureFlags> {
  return {
    reports: flags?.reports ?? true,
    marketing: flags?.marketing ?? true,
    covers: flags?.covers ?? true,
    landingPage: flags?.landingPage ?? true,
  };
}

export async function importPrecannedContentForBook(options: {
  bookId: string;
  bookVersionId?: string | null;
  fileName?: string | null;
  precannedKey?: string | null;
  features?: ImportFeatureFlags;
}): Promise<ImportPrecannedResult | null> {
  const { bookId, bookVersionId, fileName, precannedKey, features } = options;

  const pkg =
    (await findPrecannedPackageByKey(precannedKey ?? undefined)) ||
    (await findPrecannedPackageByFilename(fileName || undefined));

  if (!pkg) {
    return null;
  }

  const flags = resolveFeatureFlags(features);
  let reportsLinked = 0;
  let marketingLinked = 0;
  let coversLinked = 0;
  let primaryCoverImageUrl: string | null = null;
  let landingPageLinked = false;

  if (flags.reports && bookVersionId) {
    reportsLinked = await importReportsFromPackage(bookVersionId, pkg);
  }

  if (flags.marketing) {
    marketingLinked = await importMarketingAssetsFromPackage(bookId, pkg);
  }

  if (flags.covers) {
    const { created, primaryCoverUrl } = await importCoversFromPackage(bookId, pkg);
    coversLinked = created;
    primaryCoverImageUrl = primaryCoverUrl;
  }

  if (flags.landingPage) {
    landingPageLinked = await importLandingPageFromPackage(bookId, pkg);
  }

  return {
    packageKey: pkg.key,
    reportsLinked,
    marketingAssetsLinked: marketingLinked,
    coversLinked,
    landingPageLinked,
    primaryCoverImageUrl,
  };
}

