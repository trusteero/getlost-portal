PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getlostportal_guest_purchase` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`guestEmail` text(255) NOT NULL,
	`bookId` text(255),
	`featureType` text(50) NOT NULL,
	`amount` integer NOT NULL,
	`currency` text(10) NOT NULL DEFAULT 'USD',
	`paymentMethod` text(50),
	`paymentIntentId` text(255),
	`status` text(50) NOT NULL DEFAULT 'pending',
	`completedAt` integer,
	`createdAt` integer NOT NULL DEFAULT (unixepoch()),
	`updatedAt` integer NOT NULL DEFAULT (unixepoch()),
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `guest_purchase_email_idx` ON `getlostportal_guest_purchase`(`guestEmail`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `guest_purchase_status_idx` ON `getlostportal_guest_purchase`(`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `guest_purchase_feature_idx` ON `getlostportal_guest_purchase`(`featureType`);--> statement-breakpoint
PRAGMA foreign_keys=ON;

