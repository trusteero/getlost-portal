/**
 * Safe database migration utilities
 * Handles missing columns gracefully and ensures migrations are applied
 */

import Database from "better-sqlite3";
import { sqlite } from "./index";

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Check if a column exists in a table
 */
export function columnExists(tableName: string, columnName: string): boolean {
  if (!sqlite) {
    console.warn(`[Migrations] Database not available, cannot check column ${tableName}.${columnName}`);
    return false;
  }

  try {
    const columns = sqlite
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as ColumnInfo[];

    return columns.some((col) => col.name === columnName);
  } catch (error: any) {
    console.error(
      `[Migrations] Error checking column ${tableName}.${columnName}:`,
      error.message
    );
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
    } else {
      console.log("✅ [Migrations] All required columns exist");
    }
  } catch (error: any) {
    console.error("[Migrations] Error ensuring books table columns:", error.message);
    // Don't throw - allow app to continue
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

  try {
    console.log("[Migrations] Checking other table columns...");

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

    console.log("✅ [Migrations] Other table columns check complete");
  } catch (error: any) {
    console.error("[Migrations] Error ensuring other table columns:", error.message);
    // Don't throw - allow app to continue
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
          bookId text(255) NOT NULL,
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
          bookId text(255) NOT NULL,
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
          bookId text(255) NOT NULL,
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
          bookId text(255) NOT NULL,
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
          bookId text(255) NOT NULL,
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
          bookId text(255) NOT NULL,
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
          bookId text(255) NOT NULL,
          featureType text(50) NOT NULL,
          amount integer NOT NULL,
          currency text(10) DEFAULT 'USD' NOT NULL,
          paymentMethod text(50),
          paymentIntentId text(255),
          status text(50) DEFAULT 'pending' NOT NULL,
          completedAt integer,
          createdAt integer DEFAULT (unixepoch()) NOT NULL,
          updatedAt integer DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (userId) REFERENCES getlostportal_user(id) ON UPDATE no action ON DELETE no action,
          FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_user_idx ON getlostportal_purchase (userId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_book_idx ON getlostportal_purchase (bookId)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_feature_idx ON getlostportal_purchase (featureType)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS purchase_status_idx ON getlostportal_purchase (status)`);
      console.log("[Migrations] ✅ Created getlostportal_purchase table");
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
          bookId text(255) NOT NULL,
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
}

/**
 * Initialize migrations - call this on app startup
 * This is called automatically when the database connection is established
 */
export function initializeMigrations(): void {
  if (!sqlite) {
    console.warn("[Migrations] Database not available, skipping migrations");
    return;
  }

  try {
    console.log("[Migrations] Initializing database migrations...");
    
    // First, run Drizzle migrations to create all tables if they don't exist
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
        } catch (migrateError: any) {
          // Check if it's just a "table already exists" error
          if (migrateError?.message?.includes("already exists") || 
              migrateError?.message?.includes("duplicate") ||
              migrateError?.cause?.code === "SQLITE_ERROR") {
            console.log("[Migrations] Tables already exist, Drizzle migrations already applied");
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
    
    // Ensure essential tables exist (fallback if Drizzle migrations didn't create them)
    ensureEssentialTables();
    
    // Then ensure columns exist (adds missing columns to existing tables)
    ensureBooksTableColumns();
    ensureOtherTableColumns();
    console.log("[Migrations] Migration check complete");
  } catch (error: any) {
    console.error("[Migrations] Error during migration initialization:", error.message);
    // Don't throw - allow app to continue even if migrations fail
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

