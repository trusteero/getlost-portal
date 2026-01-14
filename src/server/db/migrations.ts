/**
 * Safe database migration utilities
 * Handles missing columns gracefully and ensures migrations are applied
 */

import Database from "better-sqlite3";
import { sqlite } from "./index";

// Guard to prevent migrations from running multiple times simultaneously
let migrationsInitialized = false;
let migrationsInitializing = false;

// Cache for column checks to avoid running on every request
let booksTableColumnsChecked = false;
let booksTableColumnsCheckTime = 0;
let otherTableColumnsChecked = false;
let otherTableColumnsCheckTime = 0;
const COLUMNS_CHECK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for column existence checks (PRAGMA queries are expensive)
const columnExistenceCache = new Map<string, boolean>();
let columnExistenceCacheTime = 0;
const COLUMN_EXISTENCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Check if a column exists in a table
 * Cached to avoid expensive PRAGMA queries on every request
 */
export function columnExists(tableName: string, columnName: string): boolean {
  if (!sqlite) {
    console.warn(`[Migrations] Database not available, cannot check column ${tableName}.${columnName}`);
    return false;
  }

  // Check cache first
  const cacheKey = `${tableName}.${columnName}`;
  const now = Date.now();
  
  // If cache is expired, clear it
  if ((now - columnExistenceCacheTime) > COLUMN_EXISTENCE_CACHE_TTL) {
    columnExistenceCache.clear();
    columnExistenceCacheTime = now;
  }
  
  // Return cached value if available
  if (columnExistenceCache.has(cacheKey)) {
    return columnExistenceCache.get(cacheKey)!;
  }

  try {
    // Cache all columns for this table at once to avoid multiple PRAGMA calls
    const columns = sqlite
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as ColumnInfo[];

    // Cache all columns from this table
    const columnNames = new Set(columns.map((col) => col.name));
    for (const col of columnNames) {
      columnExistenceCache.set(`${tableName}.${col}`, true);
    }
    // Also cache non-existent columns to avoid re-checking
    // (but only for columns we actually check)
    const exists = columnNames.has(columnName);
    if (!exists) {
      columnExistenceCache.set(cacheKey, false);
    }
    
    columnExistenceCacheTime = now;
    return exists;
  } catch (error: any) {
    console.error(
      `[Migrations] Error checking column ${tableName}.${columnName}:`,
      error.message
    );
    // Cache the error result to avoid retrying immediately
    columnExistenceCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Safely add a column if it doesn't exist
 */
export function addColumnIfMissing(
  tableName: string,
  columnName: string,
  columnDefinition: string
): boolean {
  if (!sqlite) {
    console.warn(`[Migrations] Database not available, cannot add column ${tableName}.${columnName}`);
    return false;
  }

  if (columnExists(tableName, columnName)) {
    return false; // Column already exists
  }

  try {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
    sqlite.exec(sql);
    console.log(`✅ [Migrations] Added column ${tableName}.${columnName}`);
    return true;
  } catch (error: any) {
    console.error(
      `❌ [Migrations] Failed to add column ${tableName}.${columnName}:`,
      error.message
    );
    return false;
  }
}

/**
 * Ensure all required columns exist in the books table
 * This is called automatically on startup to ensure schema is up to date
 */
export function ensureBooksTableColumns(): void {
  if (!sqlite) {
    console.warn("[Migrations] Database not available, skipping column checks");
    return;
  }

  // Cache check: skip if checked recently (within TTL)
  const now = Date.now();
  if (booksTableColumnsChecked && (now - booksTableColumnsCheckTime) < COLUMNS_CHECK_CACHE_TTL) {
    // Silently skip - no logging to reduce noise
    return;
  }

  try {
    // First, check if the table exists
    const tableCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_book'"
      )
      .get();

    if (!tableCheck) {
      console.warn("[Migrations] Books table does not exist yet, creating it...");
      // Create the book table from the first migration
      try {
        const fs = require("fs");
        const path = require("path");
        const migrationFile = path.resolve(process.cwd(), "drizzle", "0000_talented_shatterstar.sql");
        if (fs.existsSync(migrationFile)) {
          const sql = fs.readFileSync(migrationFile, "utf-8");
          // Extract the book table creation statement
          const bookTableMatch = sql.match(/CREATE TABLE[^`]*`getlostportal_book`[^;]+;/s);
          if (bookTableMatch) {
            sqlite.exec(bookTableMatch[0]);
            console.log("[Migrations] ✅ Created getlostportal_book table");
          } else {
            // Fallback: create table manually
            sqlite.exec(`
              CREATE TABLE getlostportal_book (
                id text(255) PRIMARY KEY NOT NULL,
                userId text(255) NOT NULL,
                title text(500) NOT NULL,
                description text,
                coverImageUrl text(1000),
                createdAt integer DEFAULT (unixepoch()) NOT NULL,
                updatedAt integer,
                FOREIGN KEY (userId) REFERENCES getlostportal_user(id)
              )
            `);
            console.log("[Migrations] ✅ Created getlostportal_book table (fallback)");
          }
        } else {
          // Fallback: create table manually
          sqlite.exec(`
            CREATE TABLE getlostportal_book (
              id text(255) PRIMARY KEY NOT NULL,
              userId text(255) NOT NULL,
              title text(500) NOT NULL,
              description text,
              coverImageUrl text(1000),
              createdAt integer DEFAULT (unixepoch()) NOT NULL,
              updatedAt integer,
              FOREIGN KEY (userId) REFERENCES getlostportal_user(id)
            )
          `);
          console.log("[Migrations] ✅ Created getlostportal_book table (fallback - no migration file)");
        }
      } catch (createError: any) {
        console.error("[Migrations] ❌ Failed to create book table:", createError?.message);
        return; // Can't continue without the table
      }
    }

    console.log("[Migrations] Checking books table columns...");

    const columnsToAdd = [
      {
        name: "authorName",
        definition: "text(500)",
      },
      {
        name: "authorBio",
        definition: "text",
      },
      {
        name: "manuscriptStatus",
        definition: "text(50) DEFAULT 'queued'",
      },
    ];

    let changesMade = false;
    for (const column of columnsToAdd) {
      if (addColumnIfMissing("getlostportal_book", column.name, column.definition)) {
        changesMade = true;
      }
    }

    if (changesMade) {
      console.log("✅ [Migrations] Books table columns updated");
      // Reset cache if changes were made
      booksTableColumnsChecked = false;
    } else {
      // Only log on first check or after cache expires
      if (!booksTableColumnsChecked) {
        console.log("✅ [Migrations] All required columns exist");
      }
    }

    // Update cache
    booksTableColumnsChecked = true;
    booksTableColumnsCheckTime = now;
  } catch (error: any) {
    console.error("[Migrations] Error ensuring books table columns:", error.message);
    // Don't throw - allow app to continue
    // Reset cache on error so we retry next time
    booksTableColumnsChecked = false;
  }
}

/**
 * Ensure all required columns exist in other tables (reports, marketingAssets, etc.)
 * This is called automatically on startup to ensure schema is up to date
 */
export function ensureOtherTableColumns(): void {
  if (!sqlite) {
    console.warn("[Migrations] Database not available, skipping column checks");
    return;
  }

  // Cache check: skip if checked recently (within TTL)
  const now = Date.now();
  if (otherTableColumnsChecked && (now - otherTableColumnsCheckTime) < COLUMNS_CHECK_CACHE_TTL) {
    // Silently skip - no logging to reduce noise
    return;
  }

  try {
    // Only log on first check or after cache expires
    if (!otherTableColumnsChecked) {
      console.log("[Migrations] Checking other table columns...");
    }

    // Reports table - viewedAt
    const reportsTableCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_report'"
      )
      .get();

    if (reportsTableCheck) {
      if (addColumnIfMissing("getlostportal_report", "viewedAt", "integer")) {
        console.log("✅ [Migrations] Added viewedAt to reports table");
      }
    }

    // Marketing Assets table - viewedAt and isActive
    const marketingTableCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_marketing_asset'"
      )
      .get();

    if (marketingTableCheck) {
      if (addColumnIfMissing("getlostportal_marketing_asset", "viewedAt", "integer")) {
        console.log("✅ [Migrations] Added viewedAt to marketing_asset table");
      }
      if (addColumnIfMissing("getlostportal_marketing_asset", "isActive", "integer DEFAULT 0")) {
        console.log("✅ [Migrations] Added isActive to marketing_asset table");
      }
    }

    // Book Covers table - viewedAt
    const coversTableCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_book_cover'"
      )
      .get();

    if (coversTableCheck) {
      if (addColumnIfMissing("getlostportal_book_cover", "viewedAt", "integer")) {
        console.log("✅ [Migrations] Added viewedAt to book_cover table");
      }
    }

    // Landing Pages table - viewedAt and isActive
    const landingTableCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_landing_page'"
      )
      .get();

    if (landingTableCheck) {
      if (addColumnIfMissing("getlostportal_landing_page", "viewedAt", "integer")) {
        console.log("✅ [Migrations] Added viewedAt to landing_page table");
      }
      if (addColumnIfMissing("getlostportal_landing_page", "isActive", "integer DEFAULT 0")) {
        console.log("✅ [Migrations] Added isActive to landing_page table");
      }
    }

    // Only log on first check or after cache expires
    if (!otherTableColumnsChecked) {
      console.log("✅ [Migrations] Other table columns check complete");
    }

    // Update cache
    otherTableColumnsChecked = true;
    otherTableColumnsCheckTime = now;
  } catch (error: any) {
    console.error("[Migrations] Error ensuring other table columns:", error.message);
    // Don't throw - allow app to continue
    // Reset cache on error so we retry next time
    otherTableColumnsChecked = false;
  }
}

/**
 * Ensure performance indexes exist for better query performance
 * These composite indexes significantly speed up common query patterns
 */
export function ensurePerformanceIndexes(): void {
  if (!sqlite) {
    console.warn("[Migrations] Database not available, skipping index checks");
    return;
  }

  try {
    // Check if indexes already exist before creating
    const indexExists = (indexName: string): boolean => {
      try {
        const result = sqlite!
          .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
          .get(indexName);
        return !!result;
      } catch {
        return false;
      }
    };

    // Purchases: Composite index for user + featureType + status queries
    // Used in: /api/user/upload-permission, /api/user/credits
    if (!indexExists("purchase_user_feature_status_idx")) {
      sqlite!.exec(`
        CREATE INDEX purchase_user_feature_status_idx 
        ON getlostportal_purchase(userId, featureType, status)
      `);
      console.log("[Migrations] ✅ Created index: purchase_user_feature_status_idx");
    }

    // Purchases: Composite index for user + status queries
    // Used in: /api/user/credits, filtering completed purchases
    if (!indexExists("purchase_user_status_idx")) {
      sqlite!.exec(`
        CREATE INDEX purchase_user_status_idx 
        ON getlostportal_purchase(userId, status)
      `);
      console.log("[Migrations] ✅ Created index: purchase_user_status_idx");
    }

    // Books: Composite index for user + createdAt queries
    // Used in: /api/books (ORDER BY createdAt DESC)
    if (!indexExists("book_user_created_idx")) {
      sqlite!.exec(`
        CREATE INDEX book_user_created_idx 
        ON getlostportal_book(userId, createdAt)
      `);
      console.log("[Migrations] ✅ Created index: book_user_created_idx");
    }

    // Users: Unique index on email for faster lookups and data integrity
    // Used in: Authentication, user lookups
    // Note: This will fail if duplicate emails exist - check first
    if (!indexExists("user_email_unique_idx")) {
      try {
        // Check for duplicate emails before creating unique index
        const duplicates = sqlite!
          .prepare(`
            SELECT email, COUNT(*) as count 
            FROM getlostportal_user 
            GROUP BY email 
            HAVING count > 1
          `)
          .all() as Array<{ email: string; count: number }>;

        if (duplicates.length > 0) {
          console.warn(`[Migrations] ⚠️  Cannot create unique index on email: ${duplicates.length} duplicate email(s) found`);
          console.warn(`[Migrations] Duplicate emails: ${duplicates.map(d => d.email).join(", ")}`);
          console.warn("[Migrations] Please resolve duplicate emails before creating unique index");
        } else {
          sqlite!.exec(`
            CREATE UNIQUE INDEX user_email_unique_idx 
            ON getlostportal_user(email)
          `);
          console.log("[Migrations] ✅ Created unique index: user_email_unique_idx");
        }
      } catch (error: any) {
        // If index creation fails (e.g., duplicates), log but don't throw
        console.warn(`[Migrations] ⚠️  Failed to create unique index on email: ${error?.message || error}`);
      }
    }

    // Reports: Composite index for version + status queries
    // Used in: Filtering completed reports by version
    if (!indexExists("report_version_status_idx")) {
      sqlite!.exec(`
        CREATE INDEX report_version_status_idx 
        ON getlostportal_report(bookVersionId, status)
      `);
      console.log("[Migrations] ✅ Created index: report_version_status_idx");
    }
  } catch (error: any) {
    console.error("[Migrations] Error ensuring performance indexes:", error?.message || error);
    // Don't throw - allow app to continue even if indexes fail
  }
}

/**
 * Get safe column selection - only selects columns that exist
 */
export function getSafeBookColumns(): string[] {
  if (!sqlite) {
    // Return all expected columns if we can't check
    return [
      "id",
      "title",
      "description",
      "coverImageUrl",
      "authorName",
      "authorBio",
      "manuscriptStatus",
      "createdAt",
      "updatedAt",
    ];
  }

  try {
    const columns = sqlite
      .prepare("PRAGMA table_info(getlostportal_book)")
      .all() as ColumnInfo[];

    return columns.map((col) => col.name);
  } catch (error: any) {
    console.error("[Migrations] Error getting book columns:", error.message);
    // Return safe defaults
    return ["id", "title", "description", "coverImageUrl", "createdAt", "updatedAt"];
  }
}

/**
 * Ensure essential tables exist (book_version, digest_job, etc.)
 * This is a fallback if Drizzle migrations don't create all tables
 */
function ensureEssentialTables(): void {
  if (!sqlite) {
    return;
  }

  try {
    // Check if book_version table exists
    const bookVersionCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_book_version'"
      )
      .get();

    if (!bookVersionCheck) {
      console.log("[Migrations] Creating getlostportal_book_version table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_book_version (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          versionNumber integer NOT NULL,
          fileName text(500) NOT NULL,
          fileUrl text(1000) NOT NULL,
          fileSize integer NOT NULL,
          fileType text(100) NOT NULL,
          fileData text,
          mimeType text(100),
          summary text,
          uploadedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS version_book_idx ON getlostportal_book_version (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS version_uploaded_idx ON getlostportal_book_version (uploadedAt)`);
      console.log("[Migrations] ✅ Created getlostportal_book_version table");
    }

    // Check if digest_job table exists
    const digestJobCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_digest_job'"
      )
      .get();

    if (!digestJobCheck) {
      console.log("[Migrations] Creating getlostportal_digest_job table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_digest_job (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          externalJobId text(255),
          status text(50) DEFAULT 'pending' NOT NULL,
          attempts integer DEFAULT 0 NOT NULL,
          startedAt integer,
          completedAt integer,
          lastAttemptAt integer,
          error text,
          textUrl text(500),
          coverUrl text(500),
          title text(500),
          author text(500),
          pages integer,
          words integer,
          language text(10),
          brief text,
          shortSummary text,
          summary text,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS digest_job_book_idx ON getlostportal_digest_job (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS digest_job_status_idx ON getlostportal_digest_job (status)`);
      console.log("[Migrations] ✅ Created getlostportal_digest_job table");
    }

    // Check if book_feature table exists
    const bookFeatureCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_book_feature'"
      )
      .get();

    if (!bookFeatureCheck) {
      console.log("[Migrations] Creating getlostportal_book_feature table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_book_feature (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          featureType text(50) NOT NULL,
          status text(50) DEFAULT 'locked' NOT NULL,
          unlockedAt integer,
          purchasedAt integer,
          price integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS feature_book_idx ON getlostportal_book_feature (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS feature_type_idx ON getlostportal_book_feature (featureType)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS feature_status_idx ON getlostportal_book_feature (status)`);
      sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS feature_book_type_idx ON getlostportal_book_feature (bookId, featureType)`);
      console.log("[Migrations] ✅ Created getlostportal_book_feature table");
    }

    // Check if report table exists (it should be in the first migration, but check anyway)
    const reportCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_report'"
      )
      .get();

    if (!reportCheck) {
      console.log("[Migrations] Creating getlostportal_report table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_report (
          id text(255) PRIMARY KEY NOT NULL,
          bookVersionId text(255) NOT NULL,
          status text(50) DEFAULT 'pending' NOT NULL,
          htmlContent text,
          pdfUrl text(1000),
          adminNotes text,
          requestedAt integer DEFAULT (unixepoch()) NOT NULL,
          startedAt integer,
          completedAt integer,
          analyzedBy text(255),
          viewedAt integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookVersionId) REFERENCES getlostportal_book_version(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS report_version_idx ON getlostportal_report (bookVersionId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS report_status_idx ON getlostportal_report (status)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS report_requested_idx ON getlostportal_report (requestedAt)`);
      console.log("[Migrations] ✅ Created getlostportal_report table");
    }

    // Check if marketing_asset table exists
    const marketingAssetCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_marketing_asset'"
      )
      .get();

    if (!marketingAssetCheck) {
      console.log("[Migrations] Creating getlostportal_marketing_asset table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_marketing_asset (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          assetType text(50) NOT NULL,
          title text(500),
          description text,
          fileUrl text(1000),
          thumbnailUrl text(1000),
          htmlContent text,
          metadata text,
          isActive integer DEFAULT 0,
          status text(50) DEFAULT 'pending' NOT NULL,
          viewedAt integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS marketing_book_idx ON getlostportal_marketing_asset (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS marketing_type_idx ON getlostportal_marketing_asset (assetType)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS marketing_status_idx ON getlostportal_marketing_asset (status)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS marketing_active_idx ON getlostportal_marketing_asset (isActive)`);
      console.log("[Migrations] ✅ Created getlostportal_marketing_asset table");
    }

    // Check if book_cover table exists
    const bookCoverCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_book_cover'"
      )
      .get();

    if (!bookCoverCheck) {
      console.log("[Migrations] Creating getlostportal_book_cover table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_book_cover (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          coverType text(50) NOT NULL,
          title text(500),
          imageUrl text(1000) NOT NULL,
          thumbnailUrl text(1000),
          htmlContent text,
          metadata text,
          isPrimary integer DEFAULT 0,
          status text(50) DEFAULT 'pending' NOT NULL,
          viewedAt integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS cover_book_idx ON getlostportal_book_cover (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS cover_type_idx ON getlostportal_book_cover (coverType)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS cover_status_idx ON getlostportal_book_cover (status)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS cover_primary_idx ON getlostportal_book_cover (isPrimary)`);
      console.log("[Migrations] ✅ Created getlostportal_book_cover table");
    }

    // Check if landing_page table exists
    const landingPageCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_landing_page'"
      )
      .get();

    if (!landingPageCheck) {
      console.log("[Migrations] Creating getlostportal_landing_page table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_landing_page (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          slug text(255) NOT NULL,
          title text(500),
          headline text,
          subheadline text,
          description text,
          htmlContent text,
          customCss text,
          metadata text,
          isPublished integer DEFAULT 0,
          isActive integer DEFAULT 0,
          publishedAt integer,
          status text(50) DEFAULT 'draft' NOT NULL,
          viewedAt integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS landing_book_idx ON getlostportal_landing_page (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS landing_slug_idx ON getlostportal_landing_page (slug)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS landing_status_idx ON getlostportal_landing_page (status)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS landing_published_idx ON getlostportal_landing_page (isPublished)`);
      sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS landing_slug_unique_idx ON getlostportal_landing_page (slug)`);
      console.log("[Migrations] ✅ Created getlostportal_landing_page table");
    }

    // Check if purchase table exists
    const purchaseCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_purchase'"
      )
      .get();

    if (!purchaseCheck) {
      console.log("[Migrations] Creating getlostportal_purchase table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_purchase (
          id text(255) PRIMARY KEY NOT NULL,
          userId text(255) NOT NULL,
          bookId text(255),
          featureType text(50) NOT NULL,
          amount integer NOT NULL,
          currency text(10) DEFAULT 'USD' NOT NULL,
          paymentMethod text(50),
          paymentIntentId text(255),
          status text(50) DEFAULT 'pending' NOT NULL,
          completedAt integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (userId) REFERENCES getlostportal_user(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_user_idx ON getlostportal_purchase (userId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_book_idx ON getlostportal_purchase (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_feature_idx ON getlostportal_purchase (featureType)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_status_idx ON getlostportal_purchase (status)`);
      console.log("[Migrations] ✅ Created getlostportal_purchase table");
    } else {
      // Check if bookId is nullable, if not, make it nullable
      try {
        const tableInfo = sqlite
          .prepare("PRAGMA table_info(getlostportal_purchase)")
          .all() as Array<{ name: string; notnull: number }>;
        
        const bookIdColumn = tableInfo.find(col => col.name === "bookId");
        if (bookIdColumn && bookIdColumn.notnull === 1) {
          console.log("[Migrations] Making bookId nullable in getlostportal_purchase table...");
          // SQLite doesn't support ALTER COLUMN to remove NOT NULL easily
          // We need to recreate the table: create new, copy data, drop old, rename new
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS getlostportal_purchase_new (
              id text(255) PRIMARY KEY NOT NULL,
              userId text(255) NOT NULL,
              bookId text(255),
              featureType text(50) NOT NULL,
              amount integer NOT NULL,
              currency text(10) DEFAULT 'USD' NOT NULL,
              paymentMethod text(50),
              paymentIntentId text(255),
              status text(50) DEFAULT 'pending' NOT NULL,
              completedAt integer,
              createdAt integer DEFAULT (unixepoch()) NOT NULL,
              updatedAt integer DEFAULT (unixepoch()) NOT NULL,
              FOREIGN KEY (userId) REFERENCES getlostportal_user(id) ON UPDATE no action ON DELETE no action
            )
          `);
          
          // Copy all data from old table to new
          sqlite.exec(`
            INSERT INTO getlostportal_purchase_new 
            SELECT * FROM getlostportal_purchase
          `);
          
          // Drop old table
          sqlite.exec(`DROP TABLE getlostportal_purchase`);
          
          // Rename new table
          sqlite.exec(`ALTER TABLE getlostportal_purchase_new RENAME TO getlostportal_purchase`);
          
          // Recreate indexes
          sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_user_idx ON getlostportal_purchase (userId)`);
          sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_book_idx ON getlostportal_purchase (bookId)`);
          sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_feature_idx ON getlostportal_purchase (featureType)`);
          sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_status_idx ON getlostportal_purchase (status)`);
          
          console.log("[Migrations] ✅ Made bookId nullable in getlostportal_purchase table");
        }
      } catch (error) {
        console.error("[Migrations] Error checking bookId column:", error);
      }
    }

    // Check if summary table exists
    const summaryCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_summary'"
      )
      .get();

    if (!summaryCheck) {
      console.log("[Migrations] Creating getlostportal_summary table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_summary (
          id text(255) PRIMARY KEY NOT NULL,
          bookId text(255),
          bookVersionId text(255),
          source text(50) DEFAULT 'digest' NOT NULL,
          brief text,
          shortSummary text,
          fullSummary text,
          metadata text,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action,
          FOREIGN KEY (bookVersionId) REFERENCES getlostportal_book_version(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS summary_book_idx ON getlostportal_summary (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS summary_version_idx ON getlostportal_summary (bookVersionId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS summary_source_idx ON getlostportal_summary (source)`);
      console.log("[Migrations] ✅ Created getlostportal_summary table");
    }
  } catch (error: any) {
    console.error("[Migrations] Error ensuring essential tables:", error.message);
    // Don't throw - allow app to continue
  }

  // Ensure getlostportal_guest_purchase table exists (for guest purchases feature)
  // NOTE: Drizzle adds getlostportal_ prefix, so the actual table name is getlostportal_guest_purchase
  try {
    const guestPurchaseCheck = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_guest_purchase'"
      )
      .get();

    if (!guestPurchaseCheck) {
      console.log("[Migrations] Creating getlostportal_guest_purchase table...");
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_guest_purchase (
          id text(255) PRIMARY KEY NOT NULL,
          guestEmail text(255) NOT NULL,
          bookId text(255),
          featureType text(50) NOT NULL,
          amount integer NOT NULL,
          currency text(10) NOT NULL DEFAULT 'USD',
          paymentMethod text(50),
          paymentIntentId text(255),
          status text(50) NOT NULL DEFAULT 'pending',
          completedAt integer,
          createdAt integer NOT NULL DEFAULT (unixepoch()),
          updatedAt integer NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_email_idx ON getlostportal_guest_purchase(guestEmail)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_status_idx ON getlostportal_guest_purchase(status)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_feature_idx ON getlostportal_guest_purchase(featureType)`);
      console.log("[Migrations] ✅ Created getlostportal_guest_purchase table");
    }
  } catch (guestPurchaseError) {
    console.error("[Migrations] Failed to create getlostportal_guest_purchase table:", guestPurchaseError);
    // Don't throw - allow app to continue
  }
}

/**
 * Initialize migrations - call this on app startup
 * This is called automatically when the database connection is established
 * Uses a guard to prevent multiple simultaneous runs
 */
export function initializeMigrations(): void {
  // Guard: prevent multiple simultaneous migration runs
  if (migrationsInitialized) {
    console.log("[Migrations] Migrations already initialized, skipping");
    return;
  }

  if (migrationsInitializing) {
    console.log("[Migrations] Migrations already in progress, skipping duplicate call");
    return;
  }

  if (!sqlite) {
    console.warn("[Migrations] Database not available, skipping migrations");
    return;
  }

  migrationsInitializing = true;

  try {
    console.log("[Migrations] Initializing database migrations...");
    
    // First, run Drizzle migrations to create all tables if they don't exist
    let drizzleSucceeded = false;
    try {
      const path = require("path");
      const fs = require("fs");
      const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
      const { drizzle } = require("drizzle-orm/better-sqlite3");
      
      const migrationsFolder = path.resolve(process.cwd(), "drizzle");
      if (fs.existsSync(migrationsFolder)) {
        console.log("[Migrations] Running Drizzle migrations to create tables...");
        const db = drizzle(sqlite);
        try {
          migrate(db, { migrationsFolder });
          console.log("[Migrations] ✅ Drizzle migrations completed");
          drizzleSucceeded = true;
        } catch (migrateError: any) {
          // Check if it's just a "table already exists" error
          if (migrateError?.message?.includes("already exists") || 
              migrateError?.message?.includes("duplicate") ||
              migrateError?.cause?.code === "SQLITE_ERROR") {
            console.log("[Migrations] Tables already exist, Drizzle migrations already applied");
            drizzleSucceeded = true;
          } else {
            // Log the full error for debugging
            console.error("[Migrations] ❌ Drizzle migration error:", migrateError?.message || migrateError);
            console.error("[Migrations] Error details:", JSON.stringify(migrateError, null, 2));
            throw migrateError; // Re-throw to be caught by outer catch
          }
        }
      } else {
        console.warn("[Migrations] ⚠️  Migrations folder not found:", migrationsFolder);
        console.warn("[Migrations] Skipping Drizzle migrations - tables may not be created");
      }
    } catch (migrateError: any) {
      console.error("[Migrations] ❌ Failed to run Drizzle migrations:", migrateError?.message || migrateError);
      // Don't throw - try to continue with table creation
    }
    
    // Only run ensureEssentialTables if Drizzle migrations didn't succeed
    // This saves memory by avoiding duplicate table creation attempts
    if (!drizzleSucceeded) {
      console.log("[Migrations] Drizzle migrations didn't succeed, ensuring essential tables...");
      ensureEssentialTables();
    } else {
      console.log("[Migrations] Skipping ensureEssentialTables (Drizzle migrations succeeded)");
    }
    
    // Then ensure columns exist (adds missing columns to existing tables)
    // This is lightweight and safe to run multiple times
    // Reset cache to ensure checks run at least once during initialization
    booksTableColumnsChecked = false;
    otherTableColumnsChecked = false;
    columnExistenceCache.clear(); // Clear column existence cache on initialization
    ensureBooksTableColumns();
    ensureOtherTableColumns();
    
    // Ensure performance indexes exist (composite indexes for better query performance)
    ensurePerformanceIndexes();
    
    migrationsInitialized = true;
    console.log("[Migrations] ✅ Migration check complete");
  } catch (error: any) {
    console.error("[Migrations] Error during migration initialization:", error.message);
    // Don't throw - allow app to continue even if migrations fail
    // Reset flag so we can retry on next call
    migrationsInitializing = false;
  } finally {
    migrationsInitializing = false;
  }
}

/**
 * Run all pending migrations safely
 * This can be called manually or on startup
 */
export async function runPendingMigrations(): Promise<{
  success: boolean;
  changesMade: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let changesMade = false;

  if (!sqlite) {
    return {
      success: false,
      changesMade: false,
      errors: ["Database not available"],
    };
  }

  try {
    // Ensure books table columns
    const beforeColumns = sqlite
      .prepare("PRAGMA table_info(getlostportal_book)")
      .all() as ColumnInfo[];
    const beforeColumnNames = beforeColumns.map((col) => col.name);

    ensureBooksTableColumns();
    ensureOtherTableColumns();

    const afterColumns = sqlite
      .prepare("PRAGMA table_info(getlostportal_book)")
      .all() as ColumnInfo[];
    const afterColumnNames = afterColumns.map((col) => col.name);

    if (afterColumnNames.length > beforeColumnNames.length) {
      changesMade = true;
    }

    return {
      success: true,
      changesMade,
      errors: [],
    };
  } catch (error: any) {
    errors.push(error.message);
    return {
      success: false,
      changesMade: false,
      errors,
    };
  }
}

