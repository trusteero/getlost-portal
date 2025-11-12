import { db } from "@/server/db";
import { marketingAssets, bookCovers, landingPages, books } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { normalizeFilename, extractCoreName } from "./find-seeded-report";
import { randomUUID } from "crypto";

/**
 * Find a seeded marketing asset by filename
 */
export async function findSeededMarketingAssetByFilename(
  fileName: string
): Promise<typeof marketingAssets.$inferSelect | null> {
  const normalizedFileName = normalizeFilename(fileName);
  const uploadedCore = extractCoreName(fileName);

  // Find system book
  const systemBook = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
    .limit(1);

  if (systemBook.length === 0) {
    return null;
  }

  // Get all marketing assets for system book
  const assets = await db
    .select()
    .from(marketingAssets)
    .where(eq(marketingAssets.bookId, systemBook[0]!.id));

  // Check each asset's metadata for filename match
  for (const asset of assets) {
    try {
      if (asset.metadata) {
        const metadata = JSON.parse(asset.metadata);
        const uploadFileNames = metadata.uploadFileNames || [];
        
        // Check against title and uploadFileNames
        const candidates = [
          asset.title,
          ...uploadFileNames,
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
          const seededNormalized = normalizeFilename(candidate);
          const seededCore = extractCoreName(candidate);
          
          if (
            seededNormalized === normalizedFileName ||
            seededNormalized.includes(normalizedFileName) ||
            normalizedFileName.includes(seededNormalized) ||
            seededCore === uploadedCore ||
            seededCore.includes(uploadedCore) ||
            uploadedCore.includes(seededCore)
          ) {
            console.log(
              `[Find Seeded Asset] Matched "${fileName}" with marketing asset "${candidate}"`
            );
            return asset;
          }
        }
      }
    } catch {
      // Invalid JSON, skip
      continue;
    }
  }

  return null;
}

/**
 * Find a seeded book cover by filename
 */
export async function findSeededBookCoverByFilename(
  fileName: string
): Promise<typeof bookCovers.$inferSelect | null> {
  const normalizedFileName = normalizeFilename(fileName);
  const uploadedCore = extractCoreName(fileName);

  // Find system book
  const systemBook = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
    .limit(1);

  if (systemBook.length === 0) {
    return null;
  }

  // Get all covers for system book
  const covers = await db
    .select()
    .from(bookCovers)
    .where(eq(bookCovers.bookId, systemBook[0]!.id));

  // Check each cover's metadata for filename match
  for (const cover of covers) {
    try {
      if (cover.metadata) {
        const metadata = JSON.parse(cover.metadata);
        const uploadFileNames = metadata.uploadFileNames || [];
        
        // Check against title, coverType, and uploadFileNames
        const candidates = [
          cover.title,
          cover.coverType,
          ...uploadFileNames,
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
          const seededNormalized = normalizeFilename(candidate);
          const seededCore = extractCoreName(candidate);
          
          if (
            seededNormalized === normalizedFileName ||
            seededNormalized.includes(normalizedFileName) ||
            normalizedFileName.includes(seededNormalized) ||
            seededCore === uploadedCore ||
            seededCore.includes(uploadedCore) ||
            uploadedCore.includes(seededCore)
          ) {
            console.log(
              `[Find Seeded Asset] Matched "${fileName}" with book cover "${candidate}"`
            );
            return cover;
          }
        }
      }
    } catch {
      // Invalid JSON, skip
      continue;
    }
  }

  return null;
}

/**
 * Find a seeded landing page by filename
 */
export async function findSeededLandingPageByFilename(
  fileName: string
): Promise<typeof landingPages.$inferSelect | null> {
  const normalizedFileName = normalizeFilename(fileName);
  const uploadedCore = extractCoreName(fileName);

  // Find system book
  const systemBook = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
    .limit(1);

  if (systemBook.length === 0) {
    return null;
  }

  // Get all landing pages for system book
  const pages = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.bookId, systemBook[0]!.id));

  // Check each page's metadata for filename match
  for (const page of pages) {
    try {
      if (page.metadata) {
        const metadata = JSON.parse(page.metadata);
        const uploadFileNames = metadata.uploadFileNames || [];
        
        // Check against title, slug, and uploadFileNames
        const candidates = [
          page.title,
          page.slug,
          ...uploadFileNames,
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
          const seededNormalized = normalizeFilename(candidate);
          const seededCore = extractCoreName(candidate);
          
          if (
            seededNormalized === normalizedFileName ||
            seededNormalized.includes(normalizedFileName) ||
            normalizedFileName.includes(seededNormalized) ||
            seededCore === uploadedCore ||
            seededCore.includes(uploadedCore) ||
            uploadedCore.includes(seededCore)
          ) {
            console.log(
              `[Find Seeded Asset] Matched "${fileName}" with landing page "${candidate}"`
            );
            return page;
          }
        }
      }
    } catch {
      // Invalid JSON, skip
      continue;
    }
  }

  return null;
}

/**
 * Link a seeded marketing asset to a book
 * Copies the asset data and links it to the new book
 */
export async function linkSeededMarketingAssetToBook(
  seededAsset: typeof marketingAssets.$inferSelect,
  bookId: string
): Promise<string> {
  const newAssetId = randomUUID();
  
  await db.insert(marketingAssets).values({
    id: newAssetId,
    bookId: bookId,
    assetType: seededAsset.assetType,
    title: seededAsset.title,
    description: seededAsset.description,
    fileUrl: seededAsset.fileUrl,
    thumbnailUrl: seededAsset.thumbnailUrl,
    metadata: seededAsset.metadata,
    status: seededAsset.status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return newAssetId;
}

/**
 * Link a seeded book cover to a book
 * Copies the cover data and links it to the new book
 */
export async function linkSeededBookCoverToBook(
  seededCover: typeof bookCovers.$inferSelect,
  bookId: string
): Promise<string> {
  const newCoverId = randomUUID();
  
  await db.insert(bookCovers).values({
    id: newCoverId,
    bookId: bookId,
    coverType: seededCover.coverType,
    title: seededCover.title,
    imageUrl: seededCover.imageUrl,
    thumbnailUrl: seededCover.thumbnailUrl,
    metadata: seededCover.metadata,
    isPrimary: seededCover.isPrimary,
    status: seededCover.status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return newCoverId;
}

/**
 * Link a seeded landing page to a book
 * Copies the landing page data and links it to the new book
 */
export async function linkSeededLandingPageToBook(
  seededPage: typeof landingPages.$inferSelect,
  bookId: string
): Promise<string> {
  const newPageId = randomUUID();
  
  await db.insert(landingPages).values({
    id: newPageId,
    bookId: bookId,
    slug: seededPage.slug,
    title: seededPage.title,
    headline: seededPage.headline,
    subheadline: seededPage.subheadline,
    description: seededPage.description,
    htmlContent: seededPage.htmlContent,
    customCss: seededPage.customCss,
    metadata: seededPage.metadata,
    isPublished: seededPage.isPublished,
    publishedAt: seededPage.publishedAt,
    status: seededPage.status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return newPageId;
}

