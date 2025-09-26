import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";
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
	role: d.text({ length: 50 }).default("user").notNull(), // "user" or "admin"
	password: d.text({ length: 255 }), // For email/password auth
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
		status: d.text({ length: 50 }).notNull().default("pending"), // pending, analyzing, completed
		htmlContent: d.text(), // HTML version of the report
		pdfUrl: d.text({ length: 1000 }), // URL to PDF version
		adminNotes: d.text(), // Notes from admin
		requestedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
		startedAt: d.integer({ mode: "timestamp" }),
		completedAt: d.integer({ mode: "timestamp" }),
		analyzedBy: d.text({ length: 255 }), // Admin who analyzed it
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

// Relations
export const booksRelations = relations(books, ({ one, many }) => ({
	user: one(users, { fields: [books.userId], references: [users.id] }),
	versions: many(bookVersions),
	digestJobs: many(digestJobs),
}));

export const bookVersionsRelations = relations(bookVersions, ({ one, many }) => ({
	book: one(books, { fields: [bookVersions.bookId], references: [books.id] }),
	reports: many(reports),
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
