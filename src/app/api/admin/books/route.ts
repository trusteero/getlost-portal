import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, users, digestJobs, reports, bookFeatures, marketingAssets, bookCovers, landingPages } from "@/server/db/schema";
import { desc, eq, and } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all books with user info and digest status
    const allBooks = await db
      .select({
        id: books.id,
        title: books.title,
        description: books.description,
        coverImageUrl: books.coverImageUrl,
        manuscriptStatus: books.manuscriptStatus,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(books)
      .leftJoin(users, eq(books.userId, users.id))
      .orderBy(desc(books.createdAt));

    // Get digest status for each book
    const booksWithDigest = await Promise.all(
      allBooks.map(async (book: any) => {
        // Get latest digest job
        const [latestDigest] = await db
          .select({
            id: digestJobs.id,
            status: digestJobs.status,
            createdAt: digestJobs.createdAt,
            startedAt: digestJobs.startedAt,
            completedAt: digestJobs.completedAt,
            attempts: digestJobs.attempts,
            error: digestJobs.error,
            brief: digestJobs.brief,
            summary: digestJobs.summary,
            title: digestJobs.title,
            author: digestJobs.author,
            pages: digestJobs.pages,
            words: digestJobs.words,
            language: digestJobs.language,
          })
          .from(digestJobs)
          .where(eq(digestJobs.bookId, book.id))
          .orderBy(desc(digestJobs.createdAt))
          .limit(1);

        // Get latest version info
        const [latestVersion] = await db
          .select({
            id: bookVersions.id,
            fileName: bookVersions.fileName,
            fileSize: bookVersions.fileSize,
            uploadedAt: bookVersions.uploadedAt,
          })
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id))
          .orderBy(desc(bookVersions.uploadedAt))
          .limit(1);

        // Get latest report for the latest version
        let latestReport = null;
        if (latestVersion) {
          const [report] = await db
            .select({
              id: reports.id,
              bookVersionId: reports.bookVersionId,
              status: reports.status,
              requestedAt: reports.requestedAt,
              completedAt: reports.completedAt,
              viewedAt: reports.viewedAt,
            })
            .from(reports)
            .where(eq(reports.bookVersionId, latestVersion.id))
            .orderBy(desc(reports.requestedAt))
            .limit(1);

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

        // Helper function to determine asset status for assets linked by bookId
        const getAssetStatusByBookId = async (featureType: string, assetTable: any) => {
          // Check if feature is requested/purchased
          const [feature] = await db
            .select()
            .from(bookFeatures)
            .where(
              and(
                eq(bookFeatures.bookId, book.id),
                eq(bookFeatures.featureType, featureType)
              )
            )
            .limit(1);

          const isRequested = feature && (feature.status === "purchased" || feature.status === "requested");

          if (!isRequested) {
            return "not_requested";
          }

          // Check if any asset exists
          let anyAsset;
          if (assetTable === marketingAssets) {
            [anyAsset] = await db
              .select()
              .from(marketingAssets)
              .where(eq(marketingAssets.bookId, book.id))
              .limit(1);
          } else if (assetTable === bookCovers) {
            [anyAsset] = await db
              .select()
              .from(bookCovers)
              .where(eq(bookCovers.bookId, book.id))
              .limit(1);
          } else if (assetTable === landingPages) {
            [anyAsset] = await db
              .select()
              .from(landingPages)
              .where(eq(landingPages.bookId, book.id))
              .limit(1);
          }

          if (!anyAsset) {
            return "requested";
          }

          // Check active/primary asset for viewed status
          let activeAsset;
          if (assetTable === marketingAssets) {
            // First try to find active asset
            [activeAsset] = await db
              .select()
              .from(marketingAssets)
              .where(
                and(
                  eq(marketingAssets.bookId, book.id),
                  eq(marketingAssets.isActive, true)
                )
              )
              .limit(1);
            
            // If no active asset, find HTML asset (same logic as user-facing route)
            if (!activeAsset) {
              const allAssets = await db
                .select()
                .from(marketingAssets)
                .where(eq(marketingAssets.bookId, book.id));
              
              activeAsset = allAssets.find(asset => {
                if (!asset.metadata) return false;
                try {
                  const metadata = JSON.parse(asset.metadata);
                  return metadata.variant === "html";
                } catch {
                  return false;
                }
              }) || undefined;
            }
          } else if (assetTable === bookCovers) {
            // First try to find primary cover
            [activeAsset] = await db
              .select()
              .from(bookCovers)
              .where(
                and(
                  eq(bookCovers.bookId, book.id),
                  eq(bookCovers.isPrimary, true)
                )
              )
              .limit(1);
            
            // If no primary cover, find HTML cover
            if (!activeAsset) {
              const allCovers = await db
                .select()
                .from(bookCovers)
                .where(eq(bookCovers.bookId, book.id));
              
              activeAsset = allCovers.find(cover => {
                if (!cover.metadata) return false;
                try {
                  const metadata = JSON.parse(cover.metadata);
                  return metadata.variant === "html";
                } catch {
                  return false;
                }
              }) || undefined;
            }
          } else if (assetTable === landingPages) {
            // First try to find active landing page
            [activeAsset] = await db
              .select()
              .from(landingPages)
              .where(
                and(
                  eq(landingPages.bookId, book.id),
                  eq(landingPages.isActive, true)
                )
              )
              .limit(1);
            
            // If no active landing page, get any landing page
            if (!activeAsset) {
              [activeAsset] = await db
                .select()
                .from(landingPages)
                .where(eq(landingPages.bookId, book.id))
                .limit(1);
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

        // Calculate report status (reports are linked by bookVersionId)
        let reportStatus = "not_requested";
        if (latestVersion) {
          // Check if feature is requested/purchased
          const [reportFeature] = await db
            .select()
            .from(bookFeatures)
            .where(
              and(
                eq(bookFeatures.bookId, book.id),
                eq(bookFeatures.featureType, "manuscript-report")
              )
            )
            .limit(1);

          const isRequested = reportFeature && (reportFeature.status === "purchased" || reportFeature.status === "requested");

          if (isRequested) {
            // Get all completed reports for this version (same logic as view route)
            const completedReports = await db
              .select({
                id: reports.id,
                viewedAt: reports.viewedAt,
                adminNotes: reports.adminNotes,
              })
              .from(reports)
              .where(and(
                eq(reports.bookVersionId, latestVersion.id),
                eq(reports.status, "completed")
              ))
              .orderBy(desc(reports.requestedAt));
            
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

        // Calculate other asset statuses
        const marketingStatus = await getAssetStatusByBookId("marketing-assets", marketingAssets);
        const coversStatus = await getAssetStatusByBookId("book-covers", bookCovers);
        const landingPageStatus = await getAssetStatusByBookId("landing-page", landingPages);

        return {
          ...book,
          digestJob: latestDigest || null,
          latestVersion: latestVersion || null,
          latestReport,
          reportStatus,
          marketingStatus,
          coversStatus,
          landingPageStatus,
          manuscriptStatus: book.manuscriptStatus || "queued",
        };
      })
    );

    return NextResponse.json(booksWithDigest);
  } catch (error) {
    console.error("Failed to fetch admin books:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}