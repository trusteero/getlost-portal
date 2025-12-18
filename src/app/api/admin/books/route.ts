import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, users, digestJobs, reports, bookFeatures, marketingAssets, bookCovers, landingPages } from "@/server/db/schema";
import { desc, eq, and, sql, inArray } from "drizzle-orm";
// Migration checks removed for performance - they run on startup and are cached

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Memory safety: Add pagination support
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200); // Default 50, max 200 per page
    const offset = (page - 1) * limit;

    // Skip migration checks on every request - they're cached and run on startup
    // Only run if absolutely necessary (e.g., first request after deployment)
    // ensureBooksTableColumns(); // Commented out for performance - runs on startup

    // Build select fields - include all columns (migrations ensure they exist on startup)
    const selectFields = {
      id: books.id,
      title: books.title,
      description: books.description,
      coverImageUrl: books.coverImageUrl,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
      manuscriptStatus: books.manuscriptStatus, // Assume column exists (migrations run on startup)
      userId: books.userId, // Include for join
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    };

    // Get books with user info and digest status (with pagination)
    const allBooks = await db
      .select(selectFields)
      .from(books)
      .leftJoin(users, eq(books.userId, users.id))
      .orderBy(desc(books.createdAt))
      .limit(limit)
      .offset(offset);

    if (allBooks.length === 0) {
      return NextResponse.json({
        books: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Memory safety: Batch all queries to avoid N+1 problem
    const bookIds = allBooks.map((book: any) => book.id as string);

    // Batch fetch all related data upfront
    const [
      allDigestJobs,
      allVersions,
      allReports,
      allFeatures,
      allMarketingAssets,
      allCovers,
      allLandingPages,
    ] = await Promise.all([
      // Get all digest jobs for all books
      db
        .select()
        .from(digestJobs)
        .where(inArray(digestJobs.bookId, bookIds))
        .orderBy(desc(digestJobs.createdAt)),
      
      // Get all versions for all books (exclude fileData to save memory)
      db
        .select({
          id: bookVersions.id,
          bookId: bookVersions.bookId,
          versionNumber: bookVersions.versionNumber,
          fileName: bookVersions.fileName,
          fileUrl: bookVersions.fileUrl,
          fileSize: bookVersions.fileSize,
          uploadedAt: bookVersions.uploadedAt,
          // Explicitly exclude fileData to save memory
        })
        .from(bookVersions)
        .where(inArray(bookVersions.bookId, bookIds))
        .orderBy(desc(bookVersions.uploadedAt)),
      
      // Reports will be fetched after we have version IDs
      Promise.resolve([] as Array<{
        id: string;
        bookVersionId: string;
        status: string;
        requestedAt: Date | null;
        completedAt: Date | null;
        viewedAt: Date | null;
        adminNotes: string | null;
      }>),
      
      // Get all features for all books
      db
        .select()
        .from(bookFeatures)
        .where(inArray(bookFeatures.bookId, bookIds)),
      
      // Get all marketing assets (limit per book in memory)
      db
        .select({
          id: marketingAssets.id,
          bookId: marketingAssets.bookId,
          isActive: marketingAssets.isActive,
          viewedAt: marketingAssets.viewedAt,
          metadata: marketingAssets.metadata,
          // Exclude large fields
        })
        .from(marketingAssets)
        .where(inArray(marketingAssets.bookId, bookIds))
        .orderBy(desc(marketingAssets.createdAt)),
      
      // Get all covers (limit per book in memory)
      db
        .select({
          id: bookCovers.id,
          bookId: bookCovers.bookId,
          isPrimary: bookCovers.isPrimary,
          viewedAt: bookCovers.viewedAt,
          metadata: bookCovers.metadata,
          // Exclude large fields
        })
        .from(bookCovers)
        .where(inArray(bookCovers.bookId, bookIds))
        .orderBy(desc(bookCovers.createdAt)),
      
      // Get all landing pages (limit per book in memory)
      db
        .select({
          id: landingPages.id,
          bookId: landingPages.bookId,
          isActive: landingPages.isActive,
          viewedAt: landingPages.viewedAt,
          // Exclude large fields
        })
        .from(landingPages)
        .where(inArray(landingPages.bookId, bookIds))
        .orderBy(desc(landingPages.createdAt)),
    ]);

    // Get version IDs and fetch reports
    const versionIds = allVersions.map(v => v.id);
    const allReportsWithVersions = versionIds.length > 0
      ? await db
          .select({
            id: reports.id,
            bookVersionId: reports.bookVersionId,
            status: reports.status,
            requestedAt: reports.requestedAt,
            completedAt: reports.completedAt,
            viewedAt: reports.viewedAt,
            adminNotes: reports.adminNotes,
          })
          .from(reports)
          .where(inArray(reports.bookVersionId, versionIds))
          .orderBy(desc(reports.requestedAt))
      : [];

    // Group data by bookId for efficient lookup
    const digestJobsByBookId = new Map<string, typeof allDigestJobs[0]>();
    const reportsByVersionId = new Map<string, typeof allReportsWithVersions>();
    const featuresByBookId = new Map<string, typeof allFeatures>();
    const marketingAssetsByBookId = new Map<string, typeof allMarketingAssets>();
    const coversByBookId = new Map<string, typeof allCovers>();
    const landingPagesByBookId = new Map<string, typeof allLandingPages>();

    // Group digest jobs by bookId (keep only latest)
    for (const job of allDigestJobs) {
      if (!digestJobsByBookId.has(job.bookId)) {
        digestJobsByBookId.set(job.bookId, job);
      }
    }

    // Group versions by bookId (keep only latest)
    const latestVersionsByBookId = new Map<string, typeof allVersions[0]>();
    for (const version of allVersions) {
      if (!latestVersionsByBookId.has(version.bookId)) {
        latestVersionsByBookId.set(version.bookId, version);
      }
    }

    // Group reports by versionId
    for (const report of allReportsWithVersions) {
      if (!reportsByVersionId.has(report.bookVersionId)) {
        reportsByVersionId.set(report.bookVersionId, []);
      }
      reportsByVersionId.get(report.bookVersionId)!.push(report);
    }

    // Group features by bookId
    for (const feature of allFeatures) {
      if (!featuresByBookId.has(feature.bookId)) {
        featuresByBookId.set(feature.bookId, []);
      }
      featuresByBookId.get(feature.bookId)!.push(feature);
    }

    // Group assets by bookId (limit to 20 per book to save memory)
    const MAX_ASSETS_PER_BOOK = 20;
    for (const asset of allMarketingAssets) {
      const bookAssets = marketingAssetsByBookId.get(asset.bookId) || [];
      if (bookAssets.length < MAX_ASSETS_PER_BOOK) {
        bookAssets.push(asset);
        marketingAssetsByBookId.set(asset.bookId, bookAssets);
      }
    }

    for (const cover of allCovers) {
      const bookCoversList = coversByBookId.get(cover.bookId) || [];
      if (bookCoversList.length < MAX_ASSETS_PER_BOOK) {
        bookCoversList.push(cover);
        coversByBookId.set(cover.bookId, bookCoversList);
      }
    }

    for (const landing of allLandingPages) {
      const bookLandings = landingPagesByBookId.get(landing.bookId) || [];
      if (bookLandings.length < MAX_ASSETS_PER_BOOK) {
        bookLandings.push(landing);
        landingPagesByBookId.set(landing.bookId, bookLandings);
      }
    }

    // Process books using pre-fetched data (no more database queries!)
    const booksWithDigest = allBooks.map((book: any) => {
        // Get latest digest job from pre-fetched data
        const latestDigest = digestJobsByBookId.get(book.id) || null;

        // Get latest version from pre-fetched data
        const latestVersion = latestVersionsByBookId.get(book.id) || null;

        // Get latest report for the latest version from pre-fetched data
        let latestReport = null;
        if (latestVersion) {
          const versionReports = reportsByVersionId.get(latestVersion.id) || [];
          const report = versionReports[0] || null;
          
          if (report) {
            // Map database status to UI status
            const uiStatus = report.status === "pending" ? "requested" : report.status;
            latestReport = {
              ...report,
              status: uiStatus,
              fileName: report.status === "completed" ? `report_${book.id}.pdf` : undefined,
            };
          }
        }

        // Helper function to determine asset status using pre-fetched data
        const getAssetStatusByBookId = (featureType: string, assetTable: typeof marketingAssets | typeof bookCovers | typeof landingPages) => {
          // Check if feature is requested/purchased from pre-fetched data
          const bookFeatures = featuresByBookId.get(book.id) || [];
          const feature = bookFeatures.find(f => f.featureType === featureType);

          const isRequested = feature && (feature.status === "purchased" || feature.status === "requested");

          if (!isRequested) {
            return "not_requested";
          }

          // Get assets from pre-fetched data (handle each type separately to avoid union type issues)
          let activeAsset: any = undefined;
          
          if (assetTable === marketingAssets) {
            const bookAssets = marketingAssetsByBookId.get(book.id) || [];
            if (bookAssets.length === 0) {
              return "requested";
            }
            // First try to find active asset
            activeAsset = bookAssets.find((asset) => asset.isActive === true);
            
            // If no active asset, find HTML asset
            if (!activeAsset) {
              activeAsset = bookAssets.find((asset) => {
                if (!asset.metadata) return false;
                try {
                  const metadata = JSON.parse(asset.metadata);
                  return metadata.variant === "html";
                } catch {
                  return false;
                }
              });
            }
          } else if (assetTable === bookCovers) {
            const bookAssets = coversByBookId.get(book.id) || [];
            if (bookAssets.length === 0) {
              return "requested";
            }
            // First try to find primary cover
            activeAsset = bookAssets.find((cover) => cover.isPrimary === true);
            
            // If no primary cover, find HTML cover
            if (!activeAsset) {
              activeAsset = bookAssets.find((cover) => {
                if (!cover.metadata) return false;
                try {
                  const metadata = JSON.parse(cover.metadata);
                  return metadata.variant === "html";
                } catch {
                  return false;
                }
              });
            }
          } else if (assetTable === landingPages) {
            const bookAssets = landingPagesByBookId.get(book.id) || [];
            if (bookAssets.length === 0) {
              return "requested";
            }
            // First try to find active landing page
            activeAsset = bookAssets.find((landing) => landing.isActive === true);
            
            // If no active landing page, get any landing page
            if (!activeAsset && bookAssets.length > 0) {
              activeAsset = bookAssets[0];
            }
          }

          // If no active asset, just return uploaded
          if (!activeAsset) {
            return "uploaded";
          }

          // Check if active asset has been viewed
          if (activeAsset.viewedAt) {
            return "viewed";
          }

          return "uploaded";
        };

        // Calculate report status using pre-fetched data
        let reportStatus = "not_requested";
        if (latestVersion) {
          // Check if feature is requested/purchased from pre-fetched data
          const bookFeatures = featuresByBookId.get(book.id) || [];
          const reportFeature = bookFeatures.find(f => f.featureType === "manuscript-report");

          const isRequested = reportFeature && (reportFeature.status === "purchased" || reportFeature.status === "requested");

          if (isRequested) {
            // Get all completed reports for this version from pre-fetched data
            const versionReports = reportsByVersionId.get(latestVersion.id) || [];
            const completedReports = versionReports.filter(r => r.status === "completed");
            
            // Find active report (same logic as view route)
            let activeReport = completedReports.find(r => {
              if (!r.adminNotes) return false;
              try {
                const notes = JSON.parse(r.adminNotes);
                return notes.isActive === true;
              } catch {
                return false;
              }
            });
            
            // If no active report, use the latest one
            if (!activeReport && completedReports.length > 0) {
              activeReport = completedReports[0] || undefined;
            }
            
            if (activeReport) {
              if (activeReport.viewedAt) {
                reportStatus = "viewed";
              } else {
                reportStatus = "uploaded";
              }
            } else {
              reportStatus = "requested";
            }
          }
        }

        // Calculate other asset statuses using pre-fetched data (synchronous now!)
        const marketingStatus = getAssetStatusByBookId("marketing-assets", marketingAssets);
        const coversStatus = getAssetStatusByBookId("book-covers", bookCovers);
        const landingPageStatus = getAssetStatusByBookId("landing-page", landingPages);

        return {
          ...book,
          digestJob: latestDigest || null,
          latestVersion: latestVersion || null,
          latestReport,
          reportStatus,
          marketingStatus,
          coversStatus,
          landingPageStatus,
          manuscriptStatus: (book as any).manuscriptStatus || "queued",
        };
      });

    // Get total count for pagination info
    const totalCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(books);
    const totalCount = totalCountResult[0]?.count || 0;

    return NextResponse.json({
      books: booksWithDigest,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin books:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}