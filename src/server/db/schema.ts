import { relations, sql } from "drizzle-orm";
import { index, uniqueIndex, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator(
	(name) => `getlostportal_${name}`,
);

export const users = createTable("user", (d) => ({
	id: d
		.text({ length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: d.text({ length: 255 }),
	email: d.text({ length: 255 }).notNull(),
	emailVerified: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	image: d.text({ length: 255 }),
	role: d.text({ length: 50 }).default("user").notNull(), // "user" or "admin" or "super_admin"
	password: d.text({ length: 255 }), // For email/password auth
	createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
}));

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
}));

export const accounts = createTable(
	"account",
	(d) => ({
		userId: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id),
		type: d.text({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
		provider: d.text({ length: 255 }).notNull(),
		providerAccountId: d.text({ length: 255 }).notNull(),
		refresh_token: d.text(),
		access_token: d.text(),
		expires_at: d.integer(),
		token_type: d.text({ length: 255 }),
		scope: d.text({ length: 255 }),
		id_token: d.text(),
		session_state: d.text({ length: 255 }),
	}),
	(t) => [
		primaryKey({
			columns: [t.provider, t.providerAccountId],
		}),
		index("account_user_id_idx").on(t.userId),
	],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
	"session",
	(d) => ({
		sessionToken: d.text({ length: 255 }).notNull().primaryKey(),
		userId: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id),
		expires: d.integer({ mode: "timestamp" }).notNull(),
	}),
	(t) => [index("session_userId_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
	"verification_token",
	(d) => ({
		identifier: d.text({ length: 255 }).notNull(),
		token: d.text({ length: 255 }).notNull(),
		expires: d.integer({ mode: "timestamp" }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Books table
export const books = createTable(
	"book",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: d.text({ length: 255 }).notNull().references(() => users.id),
		title: d.text({ length: 500 }).notNull(),
		description: d.text(),
		coverImageUrl: d.text({ length: 1000 }),
		authorName: d.text({ length: 500 }),
		authorBio: d.text(),
		manuscriptStatus: d.text({ length: 50 }).default("queued"), // queued, working_on, ready_to_purchase
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
	}),
	(t) => [
		index("book_user_idx").on(t.userId),
		index("book_created_idx").on(t.createdAt),
	],
);

// Book versions table (each upload is a new version)
export const bookVersions = createTable(
	"book_version",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		versionNumber: d.integer({ mode: "number" }).notNull(),
		fileName: d.text({ length: 500 }).notNull(),
		fileUrl: d.text({ length: 1000 }).notNull(),
		fileSize: d.integer({ mode: "number" }).notNull(),
		fileType: d.text({ length: 100 }).notNull(),
		fileData: d.text(), // Base64 encoded file data (legacy, will migrate to file system)
		mimeType: d.text({ length: 100 }), // MIME type of the file
		summary: d.text(),
		uploadedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("version_book_idx").on(t.bookId),
		index("version_uploaded_idx").on(t.uploadedAt),
	],
);

// Reports table
export const reports = createTable(
	"report",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookVersionId: d.text({ length: 255 }).notNull().references(() => bookVersions.id),
		status: d.text({ length: 50 }).notNull().default("pending"), // pending, analyzing, completed, preview
		htmlContent: d.text(), // HTML version of the report
		pdfUrl: d.text({ length: 1000 }), // URL to PDF version
		adminNotes: d.text(), // Notes from admin
		requestedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		startedAt: d.integer({ mode: "timestamp" }),
		completedAt: d.integer({ mode: "timestamp" }),
		analyzedBy: d.text({ length: 255 }), // Admin who analyzed it
		viewedAt: d.integer({ mode: "timestamp" }), // When was this report last viewed by the user?
	}),
	(t) => [
		index("report_version_idx").on(t.bookVersionId),
		index("report_status_idx").on(t.status),
		index("report_requested_idx").on(t.requestedAt),
	],
);

// Digest Jobs table for tracking BookDigest service jobs
export const digestJobs = createTable(
	"digest_job",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		externalJobId: d.text({ length: 255 }), // Job ID from BookDigest service
		status: d.text({ length: 50 }).notNull().default("pending"), // pending, processing, completed, failed
		attempts: d.integer({ mode: "number" }).notNull().default(0),
		startedAt: d.integer({ mode: "timestamp" }),
		completedAt: d.integer({ mode: "timestamp" }),
		lastAttemptAt: d.integer({ mode: "timestamp" }),
		error: d.text(),
		// Results from the service
		textUrl: d.text({ length: 500 }),
		coverUrl: d.text({ length: 500 }),
		title: d.text({ length: 500 }),
		author: d.text({ length: 500 }),
		pages: d.integer({ mode: "number" }),
		words: d.integer({ mode: "number" }),
		language: d.text({ length: 10 }),
		brief: d.text(),
		shortSummary: d.text(),
		summary: d.text(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("digest_job_book_idx").on(t.bookId),
		index("digest_job_status_idx").on(t.status),
	],
);

// User Activity table for tracking DAU
export const userActivity = createTable(
	"user_activity",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: d.text({ length: 255 }).notNull().references(() => users.id),
		date: d.text({ length: 10 }).notNull(), // Format: YYYY-MM-DD
		firstActivityAt: d.integer({ mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
		lastActivityAt: d.integer({ mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
		activityCount: d.integer({ mode: "number" }).notNull().default(1),
	}),
	(t) => [
		uniqueIndex("activity_user_date_idx").on(t.userId, t.date),
		index("activity_date_idx").on(t.date),
		index("activity_user_idx").on(t.userId),
	],
);

// Notifications table
export const notifications = createTable(
	"notification",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: d.text({ length: 255 }).notNull().references(() => users.id),
		type: d.text({ length: 50 }).notNull(), // report_ready, system, etc.
		title: d.text({ length: 255 }).notNull(),
		message: d.text().notNull(),
		data: d.text(), // JSON data for additional info
		read: d.integer({ mode: "boolean" }).default(false).notNull(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("notification_user_idx").on(t.userId),
		index("notification_read_idx").on(t.read),
		index("notification_created_idx").on(t.createdAt),
	],
);

// Book Features/Unlocks table - tracks which features are unlocked for each book
export const bookFeatures = createTable(
	"book_feature",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		featureType: d.text({ length: 50 }).notNull(), // summary, manuscript-report, marketing-assets, book-covers, landing-page
		status: d.text({ length: 50 }).notNull().default("locked"), // locked, unlocked, purchased, completed
		unlockedAt: d.integer({ mode: "timestamp" }),
		purchasedAt: d.integer({ mode: "timestamp" }),
		price: d.integer({ mode: "number" }), // Price in cents
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("feature_book_idx").on(t.bookId),
		index("feature_type_idx").on(t.featureType),
		index("feature_status_idx").on(t.status),
		uniqueIndex("feature_book_type_idx").on(t.bookId, t.featureType),
	],
);

// Summaries table - stores book summaries (can be from digest or manual)
export const summaries = createTable(
	"summary",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		bookVersionId: d.text({ length: 255 }).references(() => bookVersions.id), // Optional: link to specific version
		source: d.text({ length: 50 }).notNull().default("digest"), // digest, manual
		brief: d.text(), // Short summary
		shortSummary: d.text(), // Medium summary
		fullSummary: d.text(), // Full detailed summary
		metadata: d.text(), // JSON metadata (genre, themes, etc.)
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("summary_book_idx").on(t.bookId),
		index("summary_version_idx").on(t.bookVersionId),
		index("summary_source_idx").on(t.source),
	],
);

// Marketing Assets table - stores video assets, social media content, etc.
export const marketingAssets = createTable(
	"marketing_asset",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		assetType: d.text({ length: 50 }).notNull(), // video, social-post, banner, etc.
		title: d.text({ length: 500 }),
		description: d.text(),
		fileUrl: d.text({ length: 1000 }), // URL to the asset file
		thumbnailUrl: d.text({ length: 1000 }), // Thumbnail/preview image
		metadata: d.text(), // JSON metadata (dimensions, duration, etc.)
		isActive: d.integer({ mode: "boolean" }).default(false), // Is this the active asset?
		status: d.text({ length: 50 }).notNull().default("pending"), // pending, processing, completed, failed
		viewedAt: d.integer({ mode: "timestamp" }), // When was this asset last viewed by the user?
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("marketing_book_idx").on(t.bookId),
		index("marketing_type_idx").on(t.assetType),
		index("marketing_status_idx").on(t.status),
		index("marketing_active_idx").on(t.isActive),
	],
);

// Book Covers table - stores generated book covers
export const bookCovers = createTable(
	"book_cover",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		coverType: d.text({ length: 50 }).notNull(), // ebook, paperback, hardcover, social-media
		title: d.text({ length: 500 }),
		imageUrl: d.text({ length: 1000 }), // URL to cover image (nullable for HTML galleries)
		thumbnailUrl: d.text({ length: 1000 }), // Thumbnail version
		metadata: d.text(), // JSON metadata (dimensions, style, etc.)
		isPrimary: d.integer({ mode: "boolean" }).default(false), // Is this the primary cover?
		status: d.text({ length: 50 }).notNull().default("pending"), // pending, processing, completed, failed
		viewedAt: d.integer({ mode: "timestamp" }), // When was this cover last viewed by the user?
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("cover_book_idx").on(t.bookId),
		index("cover_type_idx").on(t.coverType),
		index("cover_status_idx").on(t.status),
		index("cover_primary_idx").on(t.isPrimary),
	],
);

// Landing Pages table - stores landing page content for books
export const landingPages = createTable(
	"landing_page",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		slug: d.text({ length: 255 }).notNull(), // URL slug for the landing page
		title: d.text({ length: 500 }),
		headline: d.text(), // Hero headline
		subheadline: d.text(), // Hero subheadline
		description: d.text(), // Full description/content
		htmlContent: d.text(), // Rendered HTML content
		customCss: d.text(), // Custom CSS styles
		metadata: d.text(), // JSON metadata (CTA buttons, social links, etc.)
		isPublished: d.integer({ mode: "boolean" }).default(false),
		isActive: d.integer({ mode: "boolean" }).default(false), // Is this the active landing page?
		publishedAt: d.integer({ mode: "timestamp" }),
		status: d.text({ length: 50 }).notNull().default("draft"), // draft, published, archived
		viewedAt: d.integer({ mode: "timestamp" }), // When was this landing page last viewed by the user?
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("landing_book_idx").on(t.bookId),
		index("landing_slug_idx").on(t.slug),
		index("landing_status_idx").on(t.status),
		index("landing_published_idx").on(t.isPublished),
		index("landing_active_idx").on(t.isActive),
		uniqueIndex("landing_slug_unique_idx").on(t.slug),
	],
);

// Payments/Purchases table - tracks feature purchases
export const purchases = createTable(
	"purchase",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: d.text({ length: 255 }).notNull().references(() => users.id),
		bookId: d.text({ length: 255 }).notNull().references(() => books.id),
		featureType: d.text({ length: 50 }).notNull(), // manuscript-report, marketing-assets, book-covers, landing-page
		amount: d.integer({ mode: "number" }).notNull(), // Amount in cents
		currency: d.text({ length: 10 }).notNull().default("USD"),
		paymentMethod: d.text({ length: 50 }), // stripe, paypal, etc.
		paymentIntentId: d.text({ length: 255 }), // Payment processor ID
		status: d.text({ length: 50 }).notNull().default("pending"), // pending, completed, failed, refunded
		completedAt: d.integer({ mode: "timestamp" }),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
	}),
	(t) => [
		index("purchase_user_idx").on(t.userId),
		index("purchase_book_idx").on(t.bookId),
		index("purchase_feature_idx").on(t.featureType),
		index("purchase_status_idx").on(t.status),
	],
);

// Relations - Updated to include all new tables
export const booksRelations = relations(books, ({ one, many }) => ({
	user: one(users, { fields: [books.userId], references: [users.id] }),
	versions: many(bookVersions),
	digestJobs: many(digestJobs),
	features: many(bookFeatures),
	summaries: many(summaries),
	marketingAssets: many(marketingAssets),
	covers: many(bookCovers),
	landingPages: many(landingPages),
	purchases: many(purchases),
}));

export const bookVersionsRelations = relations(bookVersions, ({ one, many }) => ({
	book: one(books, { fields: [bookVersions.bookId], references: [books.id] }),
	reports: many(reports),
	summaries: many(summaries),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
	bookVersion: one(bookVersions, { fields: [reports.bookVersionId], references: [bookVersions.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const digestJobsRelations = relations(digestJobs, ({ one }) => ({
	book: one(books, { fields: [digestJobs.bookId], references: [books.id] }),
}));

export const bookFeaturesRelations = relations(bookFeatures, ({ one }) => ({
	book: one(books, { fields: [bookFeatures.bookId], references: [books.id] }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
	book: one(books, { fields: [summaries.bookId], references: [books.id] }),
	bookVersion: one(bookVersions, { fields: [summaries.bookVersionId], references: [bookVersions.id] }),
}));

export const marketingAssetsRelations = relations(marketingAssets, ({ one }) => ({
	book: one(books, { fields: [marketingAssets.bookId], references: [books.id] }),
}));

export const bookCoversRelations = relations(bookCovers, ({ one }) => ({
	book: one(books, { fields: [bookCovers.bookId], references: [books.id] }),
}));

export const landingPagesRelations = relations(landingPages, ({ one }) => ({
	book: one(books, { fields: [landingPages.bookId], references: [books.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
	user: one(users, { fields: [purchases.userId], references: [users.id] }),
	book: one(books, { fields: [purchases.bookId], references: [books.id] }),
}));
