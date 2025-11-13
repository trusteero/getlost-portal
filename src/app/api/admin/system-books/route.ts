import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, marketingAssets, bookCovers, landingPages } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/system-books
 * Get all system books (seeded reports) with their reports and assets
 */
export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Find system book
    const systemBook = await db
      .select()
      .from(books)
      .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
      .limit(1);

    // If system book doesn't exist, try to auto-seed (non-blocking)
    if (systemBook.length === 0) {
      console.log("[System Books] System book not found, attempting to seed...");
      // Run seed script in background (fire and forget)
      import("child_process").then(({ exec }) => {
        exec("node scripts/seed-reports-only.js", {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: process.env.DATABASE_URL || "file:/var/data/db.sqlite",
            BOOK_REPORTS_PATH: process.env.BOOK_REPORTS_PATH || "/var/data/book-reports",
          },
        }, (error) => {
          if (error) {
            console.error("[System Books] Seed script failed:", error);
          } else {
            console.log("[System Books] Seed script completed");
          }
        });
      }).catch(console.error);
      
      return NextResponse.json({ 
        systemBook: null,
        reports: [],
        message: "System book not found. Seeding in progress... Please refresh in a moment."
      });
    }

    const systemBookData = systemBook[0]!;

    // Get all versions for system book
    const systemVersions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, systemBookData.id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get all reports for system versions
    console.log(`[System Books] Found ${systemVersions.length} system version(s)`);
    const allReports = await Promise.all(
      systemVersions.map(async (version) => {
        const versionReports = await db
          .select()
          .from(reports)
          .where(eq(reports.bookVersionId, version.id))
          .orderBy(desc(reports.requestedAt));

        console.log(`[System Books] Version ${version.id.substring(0, 8)}... has ${versionReports.length} report(s)`);

        return {
          version,
          reports: versionReports.map((report) => {
            // Parse adminNotes to get seeded filename
            let seededFileName = null;
            let seededFolder = null;
            let uploadFileNames: string[] = [];
            try {
              if (report.adminNotes) {
                const notes = JSON.parse(report.adminNotes);
                seededFileName = notes.seededFileName || null;
                seededFolder = notes.seededFolder || null;
                if (Array.isArray(notes.uploadFileNames)) {
                  uploadFileNames = notes.uploadFileNames.filter(
                    (name: unknown): name is string =>
                      typeof name === "string" && name.trim().length > 0
                  );
                }
              }
            } catch {
              // Invalid JSON, skip
            }

            return {
              ...report,
              seededFileName,
              seededFolder,
              uploadFileNames,
            };
          }),
        };
      })
    );

    const flatReports = allReports.flatMap(v => v.reports);
    console.log(`[System Books] Total reports found: ${flatReports.length}`);

    // Get marketing assets, covers, and landing pages for system book
    const [marketingAssetsData, coversData, landingPagesData] = await Promise.all([
      db.select().from(marketingAssets).where(eq(marketingAssets.bookId, systemBookData.id)),
      db.select().from(bookCovers).where(eq(bookCovers.bookId, systemBookData.id)),
      db.select().from(landingPages).where(eq(landingPages.bookId, systemBookData.id)),
    ]);

    // Parse uploadFileNames from metadata for each asset type
    const marketingAssetsWithMappings = marketingAssetsData.map((asset) => {
      let uploadFileNames: string[] = [];
      try {
        if (asset.metadata) {
          const metadata = JSON.parse(asset.metadata);
          uploadFileNames = metadata.uploadFileNames || [];
        }
      } catch {
        // Invalid JSON, skip
      }
      return {
        ...asset,
        uploadFileNames,
      };
    });

    const coversWithMappings = coversData.map((cover) => {
      let uploadFileNames: string[] = [];
      try {
        if (cover.metadata) {
          const metadata = JSON.parse(cover.metadata);
          uploadFileNames = metadata.uploadFileNames || [];
        }
      } catch {
        // Invalid JSON, skip
      }
      return {
        ...cover,
        uploadFileNames,
      };
    });

    const landingPagesWithMappings = landingPagesData.map((page) => {
      let uploadFileNames: string[] = [];
      try {
        if (page.metadata) {
          const metadata = JSON.parse(page.metadata);
          uploadFileNames = metadata.uploadFileNames || [];
        }
      } catch {
        // Invalid JSON, skip
      }
      return {
        ...page,
        uploadFileNames,
      };
    });

    const responseData = {
      systemBook: systemBookData,
      reports: flatReports,
      versions: systemVersions,
      marketingAssets: marketingAssetsWithMappings,
      covers: coversWithMappings,
      landingPages: landingPagesWithMappings,
    };
    
    console.log(`[System Books] Returning ${responseData.reports.length} reports to client`);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Failed to fetch system books:", error);
    return NextResponse.json(
      { error: "Failed to fetch system books" },
      { status: 500 }
    );
  }
}




