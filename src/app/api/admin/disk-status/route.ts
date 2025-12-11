import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { promises as fs } from "fs";
import { existsSync, statSync } from "fs";
import path from "path";
import { execSync } from "child_process";

export const dynamic = 'force-dynamic';

/**
 * Get disk usage statistics for a given path
 * Returns free space, used space, total space, and usage percentage
 */
function getDiskUsage(diskPath: string): {
  total: number;
  free: number;
  used: number;
  usagePercent: number;
  available: boolean;
} {
  try {
    // Try to use df command (works on Linux/macOS)
    const dfOutput = execSync(`df -k "${diskPath}"`, { encoding: 'utf-8' });
    const lines = dfOutput.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      // df output: Filesystem 1K-blocks Used Available Use% Mounted
      const total = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
      const used = parseInt(parts[2], 10) * 1024;
      const free = parseInt(parts[3], 10) * 1024;
      const usagePercent = Math.round((used / total) * 100);
      
      return {
        total,
        free,
        used,
        usagePercent,
        available: true,
      };
    }
  } catch (error) {
    console.warn("[Disk Status] Could not get disk usage via df:", error);
  }
  
  // Fallback: try to get directory size (less accurate but works)
  try {
    const stats = statSync(diskPath);
    if (stats.isDirectory()) {
      // For directories, we can't easily get total disk space
      // Return a basic structure indicating we can't determine usage
      return {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0,
        available: false,
      };
    }
  } catch (error) {
    // Path doesn't exist or not accessible
  }
  
  return {
    total: 0,
    free: 0,
    used: 0,
    usagePercent: 0,
    available: false,
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Get warning level based on disk usage
 */
function getDiskWarning(usagePercent: number, freeBytes: number): {
  level: 'none' | 'warning' | 'critical';
  message: string;
} | null {
  if (usagePercent >= 95 || freeBytes < 50 * 1024 * 1024) { // 95% or less than 50MB free
    return {
      level: 'critical',
      message: `🚨 CRITICAL: Disk usage is at ${usagePercent}% (${formatBytes(freeBytes)} free). Immediate action required!`,
    };
  }
  if (usagePercent >= 85 || freeBytes < 150 * 1024 * 1024) { // 85% or less than 150MB free
    return {
      level: 'warning',
      message: `⚠️ WARNING: Disk usage is at ${usagePercent}% (${formatBytes(freeBytes)} free). Consider upgrading disk size.`,
    };
  }
  if (usagePercent >= 75) { // 75% or more
    return {
      level: 'warning',
      message: `⚠️ Disk usage is at ${usagePercent}% (${formatBytes(freeBytes)} free). Monitor closely.`,
    };
  }
  return null;
}

/**
 * GET /api/admin/disk-status
 * Check persistent disk status and verify data persistence
 */
export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get actual database path from environment
    let dbPath = process.env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }
    
    // Resolve to absolute path
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(process.cwd(), dbPath);
    }
    
    // Determine disk path based on database location
    // If database is in /var/data, use that; otherwise use the database's directory
    const diskPath = dbPath.startsWith("/var/data") ? "/var/data" : path.dirname(dbPath);
    
    const diskExists = existsSync(diskPath);
    const diskWritable = diskExists && (await fs.access(diskPath).then(() => true).catch(() => false));
    const dbExists = existsSync(dbPath);
    
    let dbSize = 0;
    let dbTables = 0;
    let lastInit = null;
    
    if (dbExists) {
      try {
        const stats = await fs.stat(dbPath);
        dbSize = stats.size;
        
        // Try to read table count
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(dbPath, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        dbTables = tables.length;
        db.close();
      } catch (error) {
        console.error("Failed to read database info:", error);
      }
    }
    
    // Check for init marker
    try {
      const markerPath = path.join(diskPath, ".last-init");
      if (existsSync(markerPath)) {
        lastInit = await fs.readFile(markerPath, "utf-8");
      }
    } catch (error) {
      // Marker doesn't exist, that's okay
    }
    
    // Check directory structure
    const directories = {
      bookReports: existsSync(path.join(diskPath, "book-reports")),
      reports: existsSync(path.join(diskPath, "reports")),
      uploads: existsSync(path.join(diskPath, "uploads")),
      books: existsSync(path.join(diskPath, "books")),
      covers: existsSync(path.join(diskPath, "covers")),
    };
    
    // Get disk usage statistics
    const diskUsage = diskExists ? getDiskUsage(diskPath) : {
      total: 0,
      free: 0,
      used: 0,
      usagePercent: 0,
      available: false,
    };
    
    // Get disk warning if usage is high
    const diskWarning = diskUsage.available ? getDiskWarning(diskUsage.usagePercent, diskUsage.free) : null;
    
    // Combine warnings
    const warnings: string[] = [];
    if (process.env.NODE_ENV === "production" && !dbPath.startsWith("/var/data")) {
      warnings.push("⚠️ Database is NOT on persistent disk - data will be lost on redeploy!");
    }
    if (diskWarning) {
      warnings.push(diskWarning.message);
    }
    
    return NextResponse.json({
      disk: {
        path: diskPath,
        exists: diskExists,
        writable: diskWritable,
        status: diskExists && diskWritable ? "✅ Mounted and writable" : "❌ Not available",
        usage: diskUsage.available ? {
          total: diskUsage.total,
          totalFormatted: formatBytes(diskUsage.total),
          free: diskUsage.free,
          freeFormatted: formatBytes(diskUsage.free),
          used: diskUsage.used,
          usedFormatted: formatBytes(diskUsage.used),
          usagePercent: diskUsage.usagePercent,
        } : null,
        warning: diskWarning,
      },
      database: {
        path: dbPath,
        exists: dbExists,
        size: dbSize,
        sizeFormatted: dbSize > 0 ? formatBytes(dbSize) : "0 B",
        tables: dbTables,
        status: dbExists ? "✅ Exists" : "❌ Not found",
      },
      directories,
      lastInit,
      usingPersistentDisk: dbPath.startsWith("/var/data"),
      warnings: warnings.length > 0 ? warnings : null,
      warning: warnings.length > 0 ? warnings.join(" ") : null, // Backward compatibility
    });
  } catch (error) {
    console.error("Failed to check disk status:", error);
    return NextResponse.json(
      { error: "Failed to check disk status", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

