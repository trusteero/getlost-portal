/**
 * Type definitions for database entities
 * These types are inferred from the Drizzle schema to ensure type safety
 */

import type {
  books,
  bookVersions,
  reports,
  bookFeatures,
  marketingAssets,
  bookCovers,
  landingPages,
  purchases,
  users,
  digestJobs,
} from "@/server/db/schema";

// Base entity types (inferred from schema)
export type Book = typeof books.$inferSelect;
export type BookInsert = typeof books.$inferInsert;
export type BookVersion = typeof bookVersions.$inferSelect;
export type BookVersionInsert = typeof bookVersions.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type ReportInsert = typeof reports.$inferInsert;
export type BookFeature = typeof bookFeatures.$inferSelect;
export type BookFeatureInsert = typeof bookFeatures.$inferInsert;
export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type MarketingAssetInsert = typeof marketingAssets.$inferInsert;
export type BookCover = typeof bookCovers.$inferSelect;
export type BookCoverInsert = typeof bookCovers.$inferInsert;
export type LandingPage = typeof landingPages.$inferSelect;
export type LandingPageInsert = typeof landingPages.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseInsert = typeof purchases.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type DigestJob = typeof digestJobs.$inferSelect;
export type DigestJobInsert = typeof digestJobs.$inferInsert;

// Extended types for API responses
export interface BookWithDetails extends Book {
  latestVersion?: BookVersion | null;
  latestReport?: {
    id: string;
    bookVersionId: string;
    status: string;
    requestedAt: Date | null;
    completedAt: Date | null;
  } | null;
  isProcessing?: boolean;
  features?: BookFeature[];
  assetStatuses?: {
    report: string;
    marketing: string;
    covers: string;
    landingPage: string;
  };
  hasPrecannedContent?: boolean;
  isSample?: boolean;
}

export interface BookVersionWithReports extends BookVersion {
  reports: Array<{
    id: string;
    status: string;
    requestedAt: Date | null;
    completedAt: Date | null;
    htmlContent: string | null;
    pdfUrl: string | null;
    variant?: string;
  }>;
  summary?: string | null;
}

export interface BookWithVersions extends Book {
  versions: BookVersionWithReports[];
  features: BookFeature[];
}

// Asset types (union of all asset types)
export type AssetEntity = MarketingAsset | BookCover | LandingPage;

// Type guard functions
export function isMarketingAsset(asset: AssetEntity): asset is MarketingAsset {
  return "assetType" in asset && "isActive" in asset;
}

export function isBookCover(asset: AssetEntity): asset is BookCover {
  return "coverType" in asset && "isPrimary" in asset;
}

export function isLandingPage(asset: AssetEntity): asset is LandingPage {
  return "slug" in asset && "isActive" in asset;
}

