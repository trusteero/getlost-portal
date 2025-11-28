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
      console.warn("[Migrations] Books table does not exist yet, skipping column checks");
      return;
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
    ensureBooksTableColumns();
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

