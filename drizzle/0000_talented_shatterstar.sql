CREATE TABLE `getlostportal_account` (
	`userId` text(255) NOT NULL,
	`type` text(255) NOT NULL,
	`provider` text(255) NOT NULL,
	`providerAccountId` text(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text(255),
	`scope` text(255),
	`id_token` text,
	`session_state` text(255),
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `getlostportal_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `getlostportal_account` (`userId`);--> statement-breakpoint
CREATE TABLE `getlostportal_book_version` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`versionNumber` integer NOT NULL,
	`fileName` text(500) NOT NULL,
	`fileUrl` text(1000) NOT NULL,
	`fileSize` integer NOT NULL,
	`fileType` text(100) NOT NULL,
	`fileData` text,
	`mimeType` text(100),
	`summary` text,
	`uploadedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `version_book_idx` ON `getlostportal_book_version` (`bookId`);--> statement-breakpoint
CREATE INDEX `version_uploaded_idx` ON `getlostportal_book_version` (`uploadedAt`);--> statement-breakpoint
CREATE TABLE `getlostportal_book` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`title` text(500) NOT NULL,
	`description` text,
	`coverImageUrl` text(1000),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `getlostportal_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `book_user_idx` ON `getlostportal_book` (`userId`);--> statement-breakpoint
CREATE INDEX `book_created_idx` ON `getlostportal_book` (`createdAt`);--> statement-breakpoint
CREATE TABLE `getlostportal_digest_job` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookId` text(255) NOT NULL,
	`externalJobId` text(255),
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`startedAt` integer,
	`completedAt` integer,
	`lastAttemptAt` integer,
	`error` text,
	`textUrl` text(500),
	`coverUrl` text(500),
	`title` text(500),
	`author` text(500),
	`pages` integer,
	`words` integer,
	`language` text(10),
	`brief` text,
	`shortSummary` text,
	`summary` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bookId`) REFERENCES `getlostportal_book`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `digest_job_book_idx` ON `getlostportal_digest_job` (`bookId`);--> statement-breakpoint
CREATE INDEX `digest_job_status_idx` ON `getlostportal_digest_job` (`status`);--> statement-breakpoint
CREATE TABLE `getlostportal_notification` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`type` text(50) NOT NULL,
	`title` text(255) NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`read` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `getlostportal_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notification_user_idx` ON `getlostportal_notification` (`userId`);--> statement-breakpoint
CREATE INDEX `notification_read_idx` ON `getlostportal_notification` (`read`);--> statement-breakpoint
CREATE INDEX `notification_created_idx` ON `getlostportal_notification` (`createdAt`);--> statement-breakpoint
CREATE TABLE `getlostportal_report` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`bookVersionId` text(255) NOT NULL,
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`htmlContent` text,
	`pdfUrl` text(1000),
	`adminNotes` text,
	`requestedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`startedAt` integer,
	`completedAt` integer,
	`analyzedBy` text(255),
	FOREIGN KEY (`bookVersionId`) REFERENCES `getlostportal_book_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `report_version_idx` ON `getlostportal_report` (`bookVersionId`);--> statement-breakpoint
CREATE INDEX `report_status_idx` ON `getlostportal_report` (`status`);--> statement-breakpoint
CREATE INDEX `report_requested_idx` ON `getlostportal_report` (`requestedAt`);--> statement-breakpoint
CREATE TABLE `getlostportal_session` (
	`sessionToken` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `getlostportal_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `getlostportal_session` (`userId`);--> statement-breakpoint
CREATE TABLE `getlostportal_user_activity` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`date` text(10) NOT NULL,
	`firstActivityAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastActivityAt` integer DEFAULT (unixepoch()) NOT NULL,
	`activityCount` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `getlostportal_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_user_date_idx` ON `getlostportal_user_activity` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `activity_date_idx` ON `getlostportal_user_activity` (`date`);--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `getlostportal_user_activity` (`userId`);--> statement-breakpoint
CREATE TABLE `getlostportal_user` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255),
	`email` text(255) NOT NULL,
	`emailVerified` integer DEFAULT (unixepoch()),
	`image` text(255),
	`role` text(50) DEFAULT 'user' NOT NULL,
	`password` text(255),
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `getlostportal_verification_token` (
	`identifier` text(255) NOT NULL,
	`token` text(255) NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
