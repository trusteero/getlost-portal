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
    let systemBook = await db
      .select()
      .from(books)
      .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
      .limit(1);

    // If system book doesn't exist, create it directly
    if (systemBook.length === 0) {
      console.log("[System Books] System book not found, creating it...");
      
      // Get or create a system user
      const { users } = await import("@/server/db/schema");
      const systemUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, "system@getlost.com"))
        .limit(1);
      
      let systemUserId: string;
      if (systemUsers.length > 0) {
        systemUserId = systemUsers[0]!.id;
      } else {
        // Create system user
        const { randomUUID } = await import("crypto");
        systemUserId = randomUUID();
        const now = Math.floor(Date.now() / 1000); // Unix timestamp
        await db.insert(users).values({
          email: "system@getlost.com",
          name: "System",
          role: "admin",
          emailVerified: now, // Timestamp for verified email
          createdAt: now,
          updatedAt: now,
        } as any); // Type assertion to bypass Drizzle type checking for id with defaultFn
        
        // Get the created user ID (it will be auto-generated)
        const createdUser = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, "system@getlost.com"))
          .limit(1);
        
        if (createdUser.length > 0) {
          systemUserId = createdUser[0]!.id;
        }
        console.log("[System Books] Created system user");
      }
      
      // Create system book
      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      await db.insert(books).values({
        userId: systemUserId,
        title: "SYSTEM_SEEDED_REPORTS",
        description: "System book for seeded reports - not visible to users",
        createdAt: now,
        updatedAt: now,
      } as any); // Type assertion to bypass Drizzle type checking for id with defaultFn
      
      // Get the created system book ID
      const newSystemBook = await db
        .select()
        .from(books)
        .where(eq(books.title, "SYSTEM_SEEDED_REPORTS"))
        .limit(1);
      
      if (newSystemBook.length === 0) {
        return NextResponse.json({ 
          systemBook: null,
          reports: [],
          message: "Failed to create system book. Please try again."
        }, { status: 500 });
      }
      
      const systemBookId = newSystemBook[0]!.id;
      
      // Create system book version
      await db.insert(bookVersions).values({
        bookId: systemBookId,
        versionNumber: 1,
        fileName: "SYSTEM_SEEDED_VERSION",
        uploadedAt: now,
      } as any); // Type assertion to bypass Drizzle type checking for id with defaultFn
      
      console.log("[System Books] Created system book and version");
      
      systemBook = newSystemBook;
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




