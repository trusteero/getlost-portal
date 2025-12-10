import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, bookFeatures, marketingAssets, bookCovers, landingPages, purchases } from "@/server/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { extractEpubMetadata } from "@/server/utils/extract-epub-metadata";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";
import {
  importPrecannedContentForBook,
  findPrecannedCoverImageForFilename,
} from "@/server/utils/precanned-content";
import { ensureBooksTableColumns, columnExists } from "@/server/db/migrations";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure required columns exist before querying
    ensureBooksTableColumns();

    // Build select fields - only include columns that exist
    const selectFields: any = {
      id: books.id,
      title: books.title,
      description: books.description,
      coverImageUrl: books.coverImageUrl,
      createdAt: books.createdAt,
    };

    // Only add optional columns if they exist
    if (columnExists("getlostportal_book", "authorName")) {
      selectFields.authorName = books.authorName;
    }
    if (columnExists("getlostportal_book", "authorBio")) {
      selectFields.authorBio = books.authorBio;
    }
    if (columnExists("getlostportal_book", "manuscriptStatus")) {
      selectFields.manuscriptStatus = books.manuscriptStatus;
    }

    const userBooks = await db
      .select(selectFields)
      .from(books)
      .where(
        and(
          eq(books.userId, session.user.id),
          ne(books.title, "SYSTEM_SEEDED_REPORTS") // Exclude system book
        )
      )
      .orderBy(desc(books.createdAt));

    // Get latest version, report, and digest status for each book
    const booksWithDetails = await Promise.all(
      userBooks.map(async (book: any) => {
        const latestVersion = await db
          .select()
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id))
          .orderBy(desc(bookVersions.uploadedAt))
          .limit(1);

        // Metadata is now extracted directly from EPUB on upload, no digest jobs needed

        // Get latest report for the latest version
        let latestReport = null;
        if (latestVersion[0]) {
          const [report] = await db
            .select({
              id: reports.id,
              bookVersionId: reports.bookVersionId,
              status: reports.status,
              requestedAt: reports.requestedAt,
              completedAt: reports.completedAt,
            })
            .from(reports)
            .where(eq(reports.bookVersionId, latestVersion[0].id))
            .orderBy(desc(reports.requestedAt))
            .limit(1);

          if (report) {
            // Map database status to UI status for consistency
            const uiStatus = report.status === "pending" ? "requested" : report.status;
            latestReport = {
              ...report,
              status: uiStatus,
            };
          }
        }

        // Get feature statuses
        const features = await db
          .select()
          .from(bookFeatures)
          .where(eq(bookFeatures.bookId, book.id));

        // Helper function to determine asset status for assets linked by bookId
        const getAssetStatusByBookId = async (featureType: string, assetTable: any) => {
          // FIRST: Check if any asset exists (admin may have uploaded without purchase)
          // This allows admins to upload assets that users can access immediately
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

          // If assets exist, check if they're accessible
          if (anyAsset) {
            // Check if feature is requested/purchased (for precanned asset delay logic)
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

            // Check if the asset is precanned and handle 10-second delay (only if feature was purchased)
            // Admin-uploaded assets (non-precanned) are always accessible
            if (anyAsset.metadata && isRequested && feature?.purchasedAt) {
              try {
                const metadata = JSON.parse(anyAsset.metadata);
                const isPrecanned = metadata.precanned === true;
                
                if (isPrecanned) {
                  // Get timestamps
                  const assetCreatedAt = anyAsset.createdAt instanceof Date 
                    ? anyAsset.createdAt.getTime() 
                    : typeof anyAsset.createdAt === 'number' 
                      ? anyAsset.createdAt * (anyAsset.createdAt < 10000000000 ? 1000 : 1)
                      : new Date(anyAsset.createdAt).getTime();
                  
                  const purchasedAt = feature.purchasedAt instanceof Date
                    ? feature.purchasedAt.getTime()
                    : typeof feature.purchasedAt === 'number'
                      ? feature.purchasedAt * (feature.purchasedAt < 10000000000 ? 1000 : 1)
                      : new Date(feature.purchasedAt).getTime();
                  
                  // If precanned asset was created after purchase, it means it was auto-imported
                  // Don't count it - wait for admin upload
                  if (assetCreatedAt > purchasedAt) {
                    return "requested";
                  }
                  
                  // If precanned asset existed before purchase, apply 10-second delay
                  // Show "processing" for 10 seconds after purchase, then show as "uploaded"
                  if (assetCreatedAt <= purchasedAt) {
                    const timeSincePurchase = Date.now() - purchasedAt;
                    const delayMs = 10 * 1000; // 10 seconds
                    
                    if (timeSincePurchase < delayMs) {
                      // Still within 10-second delay period
                      return "requested";
                    }
                    // 10 seconds have passed, precanned asset is now available
                  }
                }
                // If not precanned (admin-uploaded), skip delay logic and continue to check viewed status
              } catch {
                // Invalid metadata, continue with normal check (treat as admin-uploaded)
              }
            }
            // If no purchase or not precanned, continue to check viewed status (admin-uploaded assets are accessible)

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

          // If no active asset but anyAsset exists, return uploaded
          if (!activeAsset) {
            return "uploaded";
          }

          // Check if active asset has been viewed
          if (activeAsset.viewedAt) {
            return "viewed";
          }

          return "uploaded";
          }

          // No assets exist - check if feature is purchased
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

          if (isRequested) {
            return "requested";
          }

          return "not_requested";
        };

        // Calculate report status (reports are linked by bookVersionId)
        let reportStatus = "not_requested";
        if (latestVersion[0]) {
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

          // Also check if there's a purchase (completed or pending) - webhook might not have processed yet
          // Pending purchases indicate the user has initiated payment but webhook hasn't completed
          const allPurchases = await db
            .select()
            .from(purchases)
            .where(
              and(
                eq(purchases.bookId, book.id),
                eq(purchases.featureType, "manuscript-report")
              )
            )
            .orderBy(desc(purchases.createdAt));

          const anyPurchase = allPurchases.length > 0 ? allPurchases[0] : undefined;

          console.log(`[Books API] Book ${book.id} report status check:`, {
            hasFeature: !!reportFeature,
            featureStatus: reportFeature?.status,
            hasPurchase: !!anyPurchase,
            purchaseStatus: anyPurchase?.status,
            purchaseId: anyPurchase?.id,
          });

          // Feature is requested if:
          // 1. Feature status is purchased/requested, OR
          // 2. There's a purchase record (pending or completed) - indicates payment was initiated
          const isRequested = (reportFeature && (reportFeature.status === "purchased" || reportFeature.status === "requested")) || 
                             (anyPurchase !== undefined);

          // Get all completed reports for this version (same logic as view route)
          const completedReports = await db
            .select({
              id: reports.id,
              viewedAt: reports.viewedAt,
              adminNotes: reports.adminNotes,
            })
            .from(reports)
            .where(and(
              eq(reports.bookVersionId, latestVersion[0].id),
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

          // If there's a completed report, user should be able to view it
          // (admin uploaded it, so it's ready)
          if (activeReport) {
            // Check if viewedAt exists and is not null/undefined
            // Drizzle converts integer timestamps to Date objects when reading
            const hasViewedAt = activeReport.viewedAt !== null && 
                                activeReport.viewedAt !== undefined;
            
            if (hasViewedAt) {
              reportStatus = "viewed";
              console.log(`[Books API] Report ${activeReport.id} has been viewed. viewedAt: ${activeReport.viewedAt}`);
            } else {
              reportStatus = "uploaded";
              console.log(`[Books API] Report ${activeReport.id} exists but not viewed yet. viewedAt: ${activeReport.viewedAt}`);
            }
          } else if (isRequested) {
            // User has requested/purchased but no report uploaded yet
            reportStatus = "requested";
            console.log(`[Books API] Report requested for book ${book.id} but not uploaded yet`);
          }
        }

        // Calculate other asset statuses
        const marketingStatus = await getAssetStatusByBookId("marketing-assets", marketingAssets);
        const coversStatus = await getAssetStatusByBookId("book-covers", bookCovers);
        const landingPageStatus = await getAssetStatusByBookId("landing-page", landingPages);


        // Check if book has any precanned content (subtle indicator for demo content)
        const hasPrecannedContent = await (async () => {
          // Check reports
          if (latestVersion[0]) {
            const precannedReports = await db
              .select()
              .from(reports)
              .where(eq(reports.bookVersionId, latestVersion[0].id))
              .limit(5);
            
            for (const report of precannedReports) {
              if (report.adminNotes) {
                try {
                  const notes = JSON.parse(report.adminNotes);
                  if (notes.precanned === true) return true;
                } catch {}
              }
            }
          }
          
          // Check marketing assets
          const precannedMarketing = await db
            .select()
            .from(marketingAssets)
            .where(eq(marketingAssets.bookId, book.id))
            .limit(1);
          
          for (const asset of precannedMarketing) {
            if (asset.metadata) {
              try {
                const metadata = JSON.parse(asset.metadata);
                if (metadata.precanned === true) return true;
              } catch {}
            }
          }
          
          // Check covers
          const precannedCovers = await db
            .select()
            .from(bookCovers)
            .where(eq(bookCovers.bookId, book.id))
            .limit(1);
          
          for (const cover of precannedCovers) {
            if (cover.metadata) {
              try {
                const metadata = JSON.parse(cover.metadata);
                if (metadata.precanned === true) return true;
              } catch {}
            }
          }
          
          // Check landing pages
          const precannedLanding = await db
            .select()
            .from(landingPages)
            .where(eq(landingPages.bookId, book.id))
            .limit(1);
          
          for (const landing of precannedLanding) {
            if (landing.metadata) {
              try {
                const metadata = JSON.parse(landing.metadata);
                if (metadata.precanned === true) return true;
              } catch {}
            }
          }
          
          return false;
        })();

        // Check if this is an example/sample book (Wool or Beach Read)
        const isSample = book.title?.includes("Wool") || book.title?.includes("Beach Read") || false;

        return {
          ...book,
          latestVersion: latestVersion[0],
          latestReport,
          isProcessing: false, // No longer using digest jobs
          features: features,
          assetStatuses: {
            report: reportStatus,
            marketing: marketingStatus,
            covers: coversStatus,
            landingPage: landingPageStatus,
          },
          hasPrecannedContent,
          isSample,
        };
      })
    );

    return NextResponse.json(booksWithDetails);
  } catch (error) {
    console.error("Failed to fetch books:", error);
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting for book upload endpoint
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "books:upload",
    RATE_LIMITS.UPLOAD,
    session.user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const formData = await request.formData();
    const title = formData.get("title") as string | null;
    const authorName = formData.get("authorName") as string | null;
    const authorBio = formData.get("authorBio") as string | null;
    const description = formData.get("description") as string || "";
    const summary = formData.get("summary") as string || "";
    const file = formData.get("file") as File;
    const coverImage = formData.get("coverImage") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Book title is required" }, { status: 400 });
    }

    if (!authorName || !authorName.trim()) {
      return NextResponse.json({ error: "Author name is required" }, { status: 400 });
    }

    // Server-side file size validation
    const { validateFileSize } = await import("@/server/utils/validate-file-size");
    const fileSizeValidation = validateFileSize(file);
    if (!fileSizeValidation.isValid) {
      return NextResponse.json(
        { error: fileSizeValidation.error },
        { status: 400 }
      );
    }

    // Validate cover image size if provided
    if (coverImage) {
      const coverSizeValidation = validateFileSize(coverImage);
      if (!coverSizeValidation.isValid) {
        return NextResponse.json(
          { error: `Cover image: ${coverSizeValidation.error}` },
          { status: 400 }
        );
      }
    }

    // Title is required, so use the provided title
    const bookTitle = title.trim();

    // Generate book ID first
    const bookId = randomUUID();

    // Handle cover image upload if provided
    let coverImageUrl: string | null = null;
    if (coverImage) {
      // Use process.cwd() to ensure we resolve from project root
      const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
      const coverDir = path.resolve(coverStoragePath);

      // Create directory if it doesn't exist
      await fs.mkdir(coverDir, { recursive: true });

      // Get file extension from MIME type
      const ext = coverImage.type.split('/')[1] || 'jpg';
      const coverFileName = `${bookId}.${ext}`;
      const coverFilePath = path.join(coverDir, coverFileName);

      // Save cover image to disk
      const bytes = await coverImage.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(coverFilePath, buffer);

      // Store the path for serving
      coverImageUrl = `/api/covers/${bookId}.${ext}`;
    }

    // Create book with pre-generated ID
    // Use form fields if provided, otherwise will be filled from extracted metadata
    // Initial manuscript status is "queued"
    // Ensure required columns exist before inserting
    ensureBooksTableColumns();

    // Build insert values - only include columns that exist
    const insertValues: any = {
      id: bookId,
      userId: session.user.id,
      title: bookTitle,
      description,
      coverImageUrl,
    };

    // Only add optional columns if they exist
    if (columnExists("getlostportal_book", "authorName")) {
      insertValues.authorName = authorName?.trim() || null;
    }
    if (columnExists("getlostportal_book", "authorBio")) {
      insertValues.authorBio = authorBio?.trim() || null;
    }
    if (columnExists("getlostportal_book", "manuscriptStatus")) {
      insertValues.manuscriptStatus = "queued"; // Initial status is queued
    }

    const newBook = await db
      .insert(books)
      .values(insertValues)
      .returning();

    const createdBook = newBook[0]!;

    // Save the book file to disk
    const bookStoragePath = process.env.BOOK_STORAGE_PATH || './uploads/books';
    const bookDir = path.resolve(bookStoragePath);

    // Create directory if it doesn't exist
    await fs.mkdir(bookDir, { recursive: true });

    // Save file with book ID as name (preserving extension for download)
    const fileExt = path.extname(file.name);
    const storedFileName = `${bookId}${fileExt}`;
    const bookFilePath = path.join(bookDir, storedFileName);

    // Save book file to disk
    const fileBytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    await fs.writeFile(bookFilePath, fileBuffer);

    // Also store file data in database for now (for backward compatibility)
    const fileBase64 = fileBuffer.toString('base64');

    // Create first version
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;
    const fileUrl = `/api/books/${bookId}/file`;

    // Ensure book_version table exists before inserting
    const { initializeMigrations } = await import("@/server/db/migrations");
    try {
      initializeMigrations();
    } catch (migrateError) {
      console.warn("[Books API] Migration check failed, continuing anyway:", migrateError);
    }

    const newVersion = await db
      .insert(bookVersions)
      .values({
        bookId: createdBook.id,
        versionNumber: 1,
        fileName,
        fileUrl,
        fileSize,
        fileType,
        fileData: fileBase64,
        mimeType: fileType,
        summary,
      })
      .returning();

    // Extract metadata from EPUB file (if EPUB format)
    let extractedTitle: string | null = null;
    let extractedAuthor: string | null = null;
    let extractedCoverUrl: string | null = null;
    
    if (fileExt.toLowerCase() === ".epub") {
      try {
        console.log(`[EPUB] Extracting metadata from ${fileName}`);
        const metadata = await extractEpubMetadata(fileBuffer, fileName);

        // Use extracted title if available and current title is from filename
        // Only use if form title was not provided
        if (metadata.title && metadata.title.trim() && !title?.trim()) {
          extractedTitle = metadata.title.trim();
          console.log(`[EPUB] Extracted title: "${extractedTitle}"`);
        }

        // Extract author if not provided in form
        if (metadata.author && metadata.author.trim() && !authorName?.trim()) {
          extractedAuthor = metadata.author.trim();
          console.log(`[EPUB] Extracted author: "${extractedAuthor}"`);
        }

        // Save cover image if extracted and not provided in form
        if (metadata.coverImage && !coverImage) {
          const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
          const coverDir = path.resolve(coverStoragePath);
          await fs.mkdir(coverDir, { recursive: true });

          // Determine file extension from MIME type
          let ext = 'jpg'; // default
          if (metadata.coverImageMimeType) {
            const mimeParts = metadata.coverImageMimeType.split('/');
            if (mimeParts[1]) {
              ext = mimeParts[1];
              // Normalize jpeg to jpg
              if (ext === 'jpeg') ext = 'jpg';
            }
          }
          
          const coverFileName = `${bookId}.${ext}`;
          const coverFilePath = path.join(coverDir, coverFileName);

          // Save cover image to disk
          await fs.writeFile(coverFilePath, metadata.coverImage);

          // Store the path for serving
          extractedCoverUrl = `/api/covers/${bookId}.${ext}`;
          console.log(`[EPUB] Extracted and saved cover image: ${extractedCoverUrl} (${metadata.coverImage.length} bytes, ${metadata.coverImageMimeType})`);
        }
      } catch (error) {
        // Log error but don't fail the book creation
        console.error("[EPUB] Failed to extract metadata:", error);
      }
    }

    // Update book with extracted metadata if available and form fields were not provided
    // Priority: form fields > extracted metadata
    const updates: {
      title?: string;
      authorName?: string;
      coverImageUrl?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    let hasUpdates = false;

    // Only use extracted title if form title was not provided
    if (extractedTitle && !title?.trim()) {
      updates.title = extractedTitle;
      hasUpdates = true;
    }

    // Only use extracted author if form authorName was not provided
    // Check if column exists before trying to update
    if (extractedAuthor && !authorName?.trim() && columnExists("getlostportal_book", "authorName")) {
      updates.authorName = extractedAuthor;
      hasUpdates = true;
    }

    // Only use extracted cover if form coverImage was not provided
    if (extractedCoverUrl && !coverImage) {
      updates.coverImageUrl = extractedCoverUrl;
      hasUpdates = true;
    }

    if (hasUpdates) {
      await db
        .update(books)
        .set(updates)
        .where(eq(books.id, createdBook.id));

      // Update the returned book object
      if (updates.title) {
        createdBook.title = updates.title;
      }
      if (updates.authorName) {
        createdBook.authorName = updates.authorName;
      }
      if (updates.coverImageUrl) {
        createdBook.coverImageUrl = updates.coverImageUrl;
      }

      console.log(`[EPUB] Updated book ${createdBook.id} with extracted metadata`);
    }

    // Attempt to import precanned content based on filename
    try {
      const precannedResult = await importPrecannedContentForBook({
        bookId: createdBook.id,
        bookVersionId: newVersion[0]!.id,
        fileName,
      });

      if (precannedResult) {
        console.log(
          `[Demo] Imported precanned package "${precannedResult.packageKey}" for book ${createdBook.id}`
        );

        // Only set precanned cover if no cover was uploaded
        if (precannedResult.primaryCoverImageUrl && !coverImageUrl) {
          await db
            .update(books)
            .set({ coverImageUrl: precannedResult.primaryCoverImageUrl, updatedAt: new Date() })
            .where(eq(books.id, createdBook.id));
          createdBook.coverImageUrl = precannedResult.primaryCoverImageUrl;
        }
      } else {
        console.log(`[Demo] No precanned content matched filename "${fileName}"`);
      }
    } catch (error) {
      console.error("[Demo] Failed to import precanned content:", error);
    }

    // Prefer a standalone cover image from precannedcontent/uploads when one
    // matches the uploaded filename (e.g. wool_cover.jpg, beach_read.jpg).
    // Only use this if no cover was uploaded and no precanned package cover was found.
    if (!coverImageUrl) {
      try {
        const uploadsCoverUrl = await findPrecannedCoverImageForFilename(fileName);
        if (uploadsCoverUrl) {
          await db
            .update(books)
            .set({ coverImageUrl: uploadsCoverUrl, updatedAt: new Date() })
            .where(eq(books.id, createdBook.id));
          createdBook.coverImageUrl = uploadsCoverUrl;
          console.log(
            `[Demo] Linked cover image from precanned uploads "${uploadsCoverUrl}" for book ${createdBook.id}`
          );
        }
      } catch (error) {
        console.error("[Demo] Failed to find cover image in precanned uploads:", error);
      }
    }

    // Send notification email for queued manuscript (after all updates are complete)
    try {
      const { sendManuscriptQueuedEmail } = await import("@/server/services/email");
      const betterAuthSchema = await import("@/server/db/better-auth-schema");
      const betterAuthUser = betterAuthSchema.user;
      const [userData] = await db
        .select({ email: betterAuthUser.email, name: betterAuthUser.name })
        .from(betterAuthUser)
        .where(eq(betterAuthUser.id, session.user.id))
        .limit(1);
      
      // Get the final book title (may have been updated with extracted metadata)
      const [finalBook] = await db
        .select({ title: books.title })
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);
      
      if (userData?.email) {
        await sendManuscriptQueuedEmail(
          userData.email,
          finalBook?.title || createdBook.title || "Untitled",
          userData.name || undefined
        );
        console.log(`[Email] Sent manuscript queued notification to ${userData.email}`);
      }
    } catch (error) {
      // Don't fail book creation if email fails
      console.error("[Email] Failed to send manuscript queued notification:", error);
    }

    return NextResponse.json({
      bookId: createdBook.id,
      versionId: newVersion[0]!.id,
    });
  } catch (error) {
    console.error("Failed to create book:", error);
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }
}