import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, bookFeatures, marketingAssets, bookCovers, landingPages, purchases } from "@/server/db/schema";
import { eq, desc, and, ne, inArray, sql } from "drizzle-orm";
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
import type {
  Book,
  BookWithDetails,
  BookVersion,
  BookFeature,
  MarketingAsset,
  BookCover,
  LandingPage,
  Purchase,
  Report,
  AssetEntity,
} from "@/server/types/database";
import { isMarketingAsset, isBookCover, isLandingPage } from "@/server/types/database";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure required columns exist before querying
    ensureBooksTableColumns();

    // Build select fields - only include columns that exist
    // Using type assertion for dynamic field selection
    const selectFields = {
      id: books.id,
      title: books.title,
      description: books.description,
      coverImageUrl: books.coverImageUrl,
      createdAt: books.createdAt,
      ...(columnExists("getlostportal_book", "authorName") ? { authorName: books.authorName } : {}),
      ...(columnExists("getlostportal_book", "authorBio") ? { authorBio: books.authorBio } : {}),
      ...(columnExists("getlostportal_book", "manuscriptStatus") ? { manuscriptStatus: books.manuscriptStatus } : {}),
    } as const;

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

    if (userBooks.length === 0) {
      return NextResponse.json([]);
    }

    // Batch fetch all related data to avoid N+1 queries
    const bookIds: string[] = userBooks.map(book => book.id as string);

    // Batch fetch: versions, features, assets, purchases, reports
    const [
      allVersions,
      allFeatures,
      allMarketingAssets,
      allCovers,
      allLandingPages,
      allPurchases,
      allReports
    ] = await Promise.all([
      // Get all versions for all books, ordered by uploadedAt desc
      db
        .select()
        .from(bookVersions)
        .where(inArray(bookVersions.bookId, bookIds))
        .orderBy(desc(bookVersions.uploadedAt)),
      
      // Get all features for all books
      db
        .select()
        .from(bookFeatures)
        .where(inArray(bookFeatures.bookId, bookIds)),
      
      // Get all marketing assets for all books
      db
        .select()
        .from(marketingAssets)
        .where(inArray(marketingAssets.bookId, bookIds)),
      
      // Get all covers for all books
      db
        .select()
        .from(bookCovers)
        .where(inArray(bookCovers.bookId, bookIds)),
      
      // Get all landing pages for all books
      db
        .select()
        .from(landingPages)
        .where(inArray(landingPages.bookId, bookIds)),
      
      // Get all purchases for all books (for report status check)
      db
        .select()
        .from(purchases)
        .where(
          and(
            inArray(purchases.bookId, bookIds),
            eq(purchases.featureType, "manuscript-report")
          )
        )
        .orderBy(desc(purchases.createdAt)),
      
      // Reports will be fetched after we have version IDs
      Promise.resolve([] as typeof reports.$inferSelect[])
    ]);

    // Get version IDs for reports query (after versions are fetched)
    const versionIds = allVersions.map(v => v.id);
    const allReportsWithVersions = versionIds.length > 0
      ? await db
          .select()
          .from(reports)
          .where(inArray(reports.bookVersionId, versionIds))
          .orderBy(desc(reports.requestedAt))
      : [];

    // Group data by bookId for efficient lookup
    const versionsByBookId = new Map<string, typeof allVersions>();
    const featuresByBookId = new Map<string, typeof allFeatures>();
    const marketingAssetsByBookId = new Map<string, typeof allMarketingAssets>();
    const coversByBookId = new Map<string, typeof allCovers>();
    const landingPagesByBookId = new Map<string, typeof allLandingPages>();
    const purchasesByBookId = new Map<string, typeof allPurchases>();
    const reportsByVersionId = new Map<string, typeof allReportsWithVersions>();

    // Group versions by bookId (keep only latest per book)
    const latestVersionsByBookId = new Map<string, typeof allVersions[0]>();
    for (const version of allVersions) {
      if (!latestVersionsByBookId.has(version.bookId)) {
        latestVersionsByBookId.set(version.bookId, version);
      }
    }

    // Group other data by bookId
    for (const feature of allFeatures) {
      if (!featuresByBookId.has(feature.bookId)) {
        featuresByBookId.set(feature.bookId, []);
      }
      featuresByBookId.get(feature.bookId)!.push(feature);
    }

    for (const asset of allMarketingAssets) {
      if (!marketingAssetsByBookId.has(asset.bookId)) {
        marketingAssetsByBookId.set(asset.bookId, []);
      }
      marketingAssetsByBookId.get(asset.bookId)!.push(asset);
    }

    for (const cover of allCovers) {
      if (!coversByBookId.has(cover.bookId)) {
        coversByBookId.set(cover.bookId, []);
      }
      coversByBookId.get(cover.bookId)!.push(cover);
    }

    for (const landing of allLandingPages) {
      if (!landingPagesByBookId.has(landing.bookId)) {
        landingPagesByBookId.set(landing.bookId, []);
      }
      landingPagesByBookId.get(landing.bookId)!.push(landing);
    }

    for (const purchase of allPurchases) {
      if (purchase.bookId) {
        if (!purchasesByBookId.has(purchase.bookId)) {
          purchasesByBookId.set(purchase.bookId, []);
        }
        purchasesByBookId.get(purchase.bookId)!.push(purchase);
      }
    }

    // Group reports by versionId
    for (const report of allReportsWithVersions) {
      if (!reportsByVersionId.has(report.bookVersionId)) {
        reportsByVersionId.set(report.bookVersionId, []);
      }
      reportsByVersionId.get(report.bookVersionId)!.push(report);
    }

    // Process each book using pre-fetched data (no database queries in loop)
    const booksWithDetails = userBooks.map((book): BookWithDetails => {
      // Get latest version for this book
      const latestVersion = latestVersionsByBookId.get(book.id);
      
      // Get features for this book
      const features = featuresByBookId.get(book.id) || [];
      
      // Get latest report for the latest version
      let latestReport = null;
      if (latestVersion) {
        const versionReports = reportsByVersionId.get(latestVersion.id) || [];
        const [report] = versionReports;
        if (report) {
          const uiStatus = report.status === "pending" ? "requested" : report.status;
          latestReport = {
            id: report.id,
            bookVersionId: report.bookVersionId,
            status: uiStatus,
            requestedAt: report.requestedAt,
            completedAt: report.completedAt,
          };
        }
      }

      // Helper function to determine asset status (uses pre-fetched data)
      const getAssetStatusByBookId = (
        featureType: string,
        assetTable: typeof marketingAssets | typeof bookCovers | typeof landingPages
      ): string => {
        // Get assets for this book from pre-fetched data
        let bookAssets: AssetEntity[] = [];
        if (assetTable === marketingAssets) {
          bookAssets = (marketingAssetsByBookId.get(book.id) || []) as AssetEntity[];
        } else if (assetTable === bookCovers) {
          bookAssets = (coversByBookId.get(book.id) || []) as AssetEntity[];
        } else if (assetTable === landingPages) {
          bookAssets = (landingPagesByBookId.get(book.id) || []) as AssetEntity[];
        }

        // Check if any asset exists
        const anyAsset = bookAssets[0];
        if (!anyAsset) {
          // No assets exist - check if feature is purchased
          const feature = features.find(f => f.featureType === featureType);
          const isRequested = feature && (feature.status === "purchased" || feature.status === "requested");
          return isRequested ? "requested" : "not_requested";
        }

        // Assets exist - check if feature is requested/purchased
        const feature = features.find(f => f.featureType === featureType);
        const isRequested = feature && (feature.status === "purchased" || feature.status === "requested");

        // Check if the asset is precanned and handle 10-second delay
        if (anyAsset.metadata && isRequested && feature?.purchasedAt) {
          try {
            const metadata = JSON.parse(anyAsset.metadata);
            const isPrecanned = metadata.precanned === true;
            
            if (isPrecanned) {
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
              
              if (assetCreatedAt > purchasedAt) {
                return "requested";
              }
              
              if (assetCreatedAt <= purchasedAt) {
                const timeSincePurchase = Date.now() - purchasedAt;
                const delayMs = 10 * 1000;
                if (timeSincePurchase < delayMs) {
                  return "requested";
                }
              }
            }
          } catch (error) {
            console.warn(`[Books API] Failed to parse metadata for asset ${anyAsset?.id || 'unknown'}:`, error);
          }
        }

        // Find active/primary asset
        let activeAsset: AssetEntity | undefined;
        if (assetTable === marketingAssets) {
          activeAsset = bookAssets.find((a): a is MarketingAsset => isMarketingAsset(a) && a.isActive === true);
          if (!activeAsset) {
            activeAsset = bookAssets.find((asset): asset is MarketingAsset => {
              if (!isMarketingAsset(asset) || !asset.metadata) return false;
              try {
                const metadata = JSON.parse(asset.metadata);
                return metadata.variant === "html";
              } catch {
                return false;
              }
            });
          }
        } else if (assetTable === bookCovers) {
          activeAsset = bookAssets.find((a): a is BookCover => isBookCover(a) && a.isPrimary === true);
          if (!activeAsset) {
            activeAsset = bookAssets.find((cover): cover is BookCover => {
              if (!isBookCover(cover) || !cover.metadata) return false;
              try {
                const metadata = JSON.parse(cover.metadata);
                return metadata.variant === "html";
              } catch {
                return false;
              }
            });
          }
        } else if (assetTable === landingPages) {
          activeAsset = bookAssets.find((a): a is LandingPage => isLandingPage(a) && a.isActive === true) || bookAssets[0];
        }

        if (!activeAsset) {
          return "uploaded";
        }

        if (activeAsset.viewedAt) {
          return "viewed";
        }

        return "uploaded";
      };

      // Calculate report status
      let reportStatus = "not_requested";
      if (latestVersion) {
        const reportFeature = features.find(f => f.featureType === "manuscript-report");
        const bookPurchases = purchasesByBookId.get(book.id) || [];
        const anyPurchase = bookPurchases[0];

        const isRequested = (reportFeature && (reportFeature.status === "purchased" || reportFeature.status === "requested")) || 
                           (anyPurchase !== undefined);

        const versionReports = reportsByVersionId.get(latestVersion.id) || [];
        const completedReports = versionReports.filter(r => r.status === "completed");
        
        let activeReport = completedReports.find(r => {
          if (!r.adminNotes) return false;
          try {
            const notes = JSON.parse(r.adminNotes);
            return notes.isActive === true;
          } catch {
            return false;
          }
        });
        
        if (!activeReport && completedReports.length > 0) {
          activeReport = completedReports[0];
        }

        if (activeReport) {
          const hasViewedAt = activeReport.viewedAt !== null && activeReport.viewedAt !== undefined;
          reportStatus = hasViewedAt ? "viewed" : "uploaded";
        } else if (isRequested) {
          reportStatus = "requested";
        }
      }

      // Calculate other asset statuses
      const marketingStatus = getAssetStatusByBookId("marketing-assets", marketingAssets);
      const coversStatus = getAssetStatusByBookId("book-covers", bookCovers);
      const landingPageStatus = getAssetStatusByBookId("landing-page", landingPages);

      // Check if book has any precanned content
      let hasPrecannedContent = false;
      if (latestVersion) {
        const versionReports = reportsByVersionId.get(latestVersion.id) || [];
        for (const report of versionReports.slice(0, 5)) {
          if (report.adminNotes) {
            try {
              const notes = JSON.parse(report.adminNotes);
              if (notes.precanned === true) {
                hasPrecannedContent = true;
                break;
              }
            } catch {
              // ignore
            }
          }
        }
      }
      
      if (!hasPrecannedContent) {
        const marketing = marketingAssetsByBookId.get(book.id) || [];
        const covers = coversByBookId.get(book.id) || [];
        const landing = landingPagesByBookId.get(book.id) || [];
        
        for (const asset of [...marketing, ...covers, ...landing]) {
          if (asset.metadata) {
            try {
              const metadata = JSON.parse(asset.metadata);
              if (metadata.precanned === true) {
                hasPrecannedContent = true;
                break;
              }
            } catch {
              // ignore
            }
          }
        }
      }

      const bookTitle = (book.title as string) || "";
      const isSample = bookTitle.includes("Wool") || bookTitle.includes("Beach Read") || false;

      return {
        id: book.id as string,
        userId: "" as string, // Not included in select, but required by type
        title: bookTitle,
        description: (book.description as string | null) || null,
        coverImageUrl: (book.coverImageUrl as string | null) || null,
        authorName: ("authorName" in book ? (book.authorName as string | null) : null) || null,
        authorBio: ("authorBio" in book ? (book.authorBio as string | null) : null) || null,
        manuscriptStatus: ("manuscriptStatus" in book ? (book.manuscriptStatus as string | null) : null) || null,
        createdAt: (book.createdAt as Date) || new Date(),
        updatedAt: null as Date | null,
        latestVersion: latestVersion || null,
        latestReport,
        isProcessing: false,
        features: features,
        assetStatuses: {
          report: reportStatus,
          marketing: marketingStatus,
          covers: coversStatus,
          landingPage: landingPageStatus,
        },
        hasPrecannedContent,
        isSample,
      } as BookWithDetails;
    });

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

    // Sanitize all user input to prevent XSS attacks
    const { sanitizeTitle, sanitizeDescription, sanitizeSummary } = await import("@/server/utils/sanitize-input");
    
    const sanitizedTitle = sanitizeTitle(title);
    const sanitizedAuthorName = sanitizeTitle(authorName);
    const sanitizedAuthorBio = sanitizeDescription(authorBio);
    const sanitizedDescription = sanitizeDescription(description);
    const sanitizedSummary = sanitizeSummary(summary);

    // Validate required fields (after sanitization)
    if (!sanitizedTitle) {
      return NextResponse.json({ error: "Book title is required" }, { status: 400 });
    }

    if (!sanitizedAuthorName) {
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

    // Server-side file type validation for manuscript
    const { validateManuscriptFileType } = await import("@/server/utils/validate-file-type");
    const fileTypeValidation = validateManuscriptFileType(file);
    if (!fileTypeValidation.isValid) {
      return NextResponse.json(
        { error: fileTypeValidation.error },
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

      // Server-side file type validation for cover image
      const { validateImageFileType } = await import("@/server/utils/validate-file-type");
      const coverTypeValidation = validateImageFileType(coverImage);
      if (!coverTypeValidation.isValid) {
        return NextResponse.json(
          { error: `Cover image: ${coverTypeValidation.error}` },
          { status: 400 }
        );
      }
    }

    // Use sanitized values
    const bookTitle = sanitizedTitle;

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
    // Use sanitized values to prevent XSS
    const insertValues = {
      id: bookId,
      userId: session.user.id,
      title: bookTitle,
      description: sanitizedDescription,
      coverImageUrl,
      ...(columnExists("getlostportal_book", "authorName") ? { authorName: sanitizedAuthorName } : {}),
      ...(columnExists("getlostportal_book", "authorBio") ? { authorBio: sanitizedAuthorBio } : {}),
      ...(columnExists("getlostportal_book", "manuscriptStatus") ? { manuscriptStatus: "queued" as const } : {}),
    };

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
      console.warn("[Books API] Migration error details:", {
        message: migrateError instanceof Error ? migrateError.message : String(migrateError),
        stack: migrateError instanceof Error ? migrateError.stack : undefined,
      });
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
        summary: sanitizedSummary,
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