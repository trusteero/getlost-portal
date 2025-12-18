PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- Add composite indexes for better query performance
-- These indexes significantly speed up common query patterns

-- Purchases: Composite index for user + featureType + status queries
-- Used in: /api/user/upload-permission, /api/user/credits
CREATE INDEX IF NOT EXISTS `purchase_user_feature_status_idx` ON `getlostportal_purchase`(`userId`, `featureType`, `status`);--> statement-breakpoint

-- Purchases: Composite index for user + status queries  
-- Used in: /api/user/credits, filtering completed purchases
CREATE INDEX IF NOT EXISTS `purchase_user_status_idx` ON `getlostportal_purchase`(`userId`, `status`);--> statement-breakpoint

-- Books: Composite index for user + createdAt queries
-- Used in: /api/books (ORDER BY createdAt DESC)
CREATE INDEX IF NOT EXISTS `book_user_created_idx` ON `getlostportal_book`(`userId`, `createdAt`);--> statement-breakpoint

-- Users: Unique index on email for faster lookups and data integrity
-- Used in: Authentication, user lookups
-- Note: This will fail if duplicate emails exist. Check first or handle gracefully.
CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique_idx` ON `getlostportal_user`(`email`);--> statement-breakpoint

-- Reports: Composite index for version + status queries
-- Used in: Filtering completed reports by version
CREATE INDEX IF NOT EXISTS `report_version_status_idx` ON `getlostportal_report`(`bookVersionId`, `status`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
