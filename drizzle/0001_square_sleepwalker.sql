CREATE TABLE `getlostportal_book_cover` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`coverType` text(50) NOT NULL,
	`title` text(500),
	`imageUrl` text(1000) NOT NULL,
	`thumbnailUrl` text(1000),
	`metadata` text,
	`isPrimary` integer DEFAULT false,
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cover_book_idx` ON `getlostportal_book_cover` (`bookId`);--> statement-breakpoint
CREATE INDEX `cover_type_idx` ON `getlostportal_book_cover` (`coverType`);--> statement-breakpoint
CREATE INDEX `cover_status_idx` ON `getlostportal_book_cover` (`status`);--> statement-breakpoint
CREATE INDEX `cover_primary_idx` ON `getlostportal_book_cover` (`isPrimary`);--> statement-breakpoint
CREATE TABLE `getlostportal_book_feature` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`featureType` text(50) NOT NULL,
	`status` text(50) DEFAULT 'locked' NOT NULL,
	`unlockedAt` integer,
	`purchasedAt` integer,
	`price` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feature_book_idx` ON `getlostportal_book_feature` (`bookId`);--> statement-breakpoint
CREATE INDEX `feature_type_idx` ON `getlostportal_book_feature` (`featureType`);--> statement-breakpoint
CREATE INDEX `feature_status_idx` ON `getlostportal_book_feature` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `feature_book_type_idx` ON `getlostportal_book_feature` (`bookId`,`featureType`);--> statement-breakpoint
CREATE TABLE `getlostportal_landing_page` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`slug` text(255) NOT NULL,
	`title` text(500),
	`headline` text,
	`subheadline` text,
	`description` text,
	`htmlContent` text,
	`customCss` text,
	`metadata` text,
	`isPublished` integer DEFAULT false,
	`publishedAt` integer,
	`status` text(50) DEFAULT 'draft' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `landing_book_idx` ON `getlostportal_landing_page` (`bookId`);--> statement-breakpoint
CREATE INDEX `landing_slug_idx` ON `getlostportal_landing_page` (`slug`);--> statement-breakpoint
CREATE INDEX `landing_status_idx` ON `getlostportal_landing_page` (`status`);--> statement-breakpoint
CREATE INDEX `landing_published_idx` ON `getlostportal_landing_page` (`isPublished`);--> statement-breakpoint
CREATE UNIQUE INDEX `landing_slug_unique_idx` ON `getlostportal_landing_page` (`slug`);--> statement-breakpoint
CREATE TABLE `getlostportal_marketing_asset` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`assetType` text(50) NOT NULL,
	`title` text(500),
	`description` text,
	`fileUrl` text(1000),
	`thumbnailUrl` text(1000),
	`metadata` text,
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `marketing_book_idx` ON `getlostportal_marketing_asset` (`bookId`);--> statement-breakpoint
CREATE INDEX `marketing_type_idx` ON `getlostportal_marketing_asset` (`assetType`);--> statement-breakpoint
CREATE INDEX `marketing_status_idx` ON `getlostportal_marketing_asset` (`status`);--> statement-breakpoint
CREATE TABLE `getlostportal_purchase` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`bookId` text(255) NOT NULL,
	`featureType` text(50) NOT NULL,
	`amount` integer NOT NULL,
	`currency` text(10) DEFAULT 'USD' NOT NULL,
	`paymentMethod` text(50),
	`paymentIntentId` text(255),
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`completedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `getlostportal_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchase_user_idx` ON `getlostportal_purchase` (`userId`);--> statement-breakpoint
CREATE INDEX `purchase_book_idx` ON `getlostportal_purchase` (`bookId`);--> statement-breakpoint
CREATE INDEX `purchase_feature_idx` ON `getlostportal_purchase` (`featureType`);--> statement-breakpoint
CREATE INDEX `purchase_status_idx` ON `getlostportal_purchase` (`status`);--> statement-breakpoint
CREATE TABLE `getlostportal_summary` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`bookVersionId` text(255),
	`source` text(50) DEFAULT 'digest' NOT NULL,
	`brief` text,
	`shortSummary` text,
	`fullSummary` text,
	`metadata` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bookVersionId`) REFERENCES `getlostportal_book_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `summary_book_idx` ON `getlostportal_summary` (`bookId`);--> statement-breakpoint
CREATE INDEX `summary_version_idx` ON `getlostportal_summary` (`bookVersionId`);--> statement-breakpoint
CREATE INDEX `summary_source_idx` ON `getlostportal_summary` (`source`);