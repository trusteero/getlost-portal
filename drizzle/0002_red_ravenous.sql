PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_getlostportal_book_cover` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`coverType` text(50) NOT NULL,
	`title` text(500),
	`imageUrl` text(1000),
	`thumbnailUrl` text(1000),
	`metadata` text,
	`isPrimary` integer DEFAULT false,
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`viewedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_getlostportal_book_cover`("id", "bookId", "coverType", "title", "imageUrl", "thumbnailUrl", "metadata", "isPrimary", "status", "viewedAt", "createdAt", "updatedAt") SELECT "id", "bookId", "coverType", "title", "imageUrl", "thumbnailUrl", "metadata", "isPrimary", "status", "viewedAt", "createdAt", "updatedAt" FROM `getlostportal_book_cover`;--> statement-breakpoint
DROP TABLE `getlostportal_book_cover`;--> statement-breakpoint
ALTER TABLE `__new_getlostportal_book_cover` RENAME TO `getlostportal_book_cover`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `cover_book_idx` ON `getlostportal_book_cover` (`bookId`);--> statement-breakpoint
CREATE INDEX `cover_type_idx` ON `getlostportal_book_cover` (`coverType`);--> statement-breakpoint
CREATE INDEX `cover_status_idx` ON `getlostportal_book_cover` (`status`);--> statement-breakpoint
CREATE INDEX `cover_primary_idx` ON `getlostportal_book_cover` (`isPrimary`);--> statement-breakpoint
ALTER TABLE `getlostportal_landing_page` ADD `isActive` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `getlostportal_landing_page` ADD `viewedAt` integer;--> statement-breakpoint
CREATE INDEX `landing_active_idx` ON `getlostportal_landing_page` (`isActive`);--> statement-breakpoint
ALTER TABLE `getlostportal_marketing_asset` ADD `isActive` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `getlostportal_marketing_asset` ADD `viewedAt` integer;--> statement-breakpoint
CREATE INDEX `marketing_active_idx` ON `getlostportal_marketing_asset` (`isActive`);--> statement-breakpoint
ALTER TABLE `getlostportal_report` ADD `viewedAt` integer;