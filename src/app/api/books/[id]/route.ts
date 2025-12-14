import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, bookFeatures } from "@/server/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { extractSummaryFromReportHtml } from "@/server/utils/extract-report-summary";
import { promises as fs } from "fs";
import path from "path";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";
import type {
  BookVersion,
  BookVersionWithReports,
  BookWithVersions,
  Report,
} from "@/server/types/database";
import { apiErrors } from "@/server/utils/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting for book detail endpoint
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "books:detail",
    RATE_LIMITS.API,
    session.user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get book details
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const bookData = book[0]!;

    // Check if user owns the book or is admin
    const isAdmin = await isAdminFromRequest(request);
    if (bookData.userId !== session.user.id && !isAdmin) {
      return apiErrors.forbidden();
    }

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt));

    if (versions.length === 0) {
      return NextResponse.json({
        ...bookData,
        versions: [],
        features: [],
      });
    }

    // Batch fetch all reports for all versions (fixes N+1 query)
    const versionIds = versions.map(v => v.id);
    const allReports = await db
      .select({
        id: reports.id,
        status: reports.status,
        requestedAt: reports.requestedAt,
        completedAt: reports.completedAt,
        htmlContent: reports.htmlContent,
        pdfUrl: reports.pdfUrl,
        adminNotes: reports.adminNotes,
        bookVersionId: reports.bookVersionId,
      })
      .from(reports)
      .where(inArray(reports.bookVersionId, versionIds))
      .orderBy(desc(reports.requestedAt));

    // Type for the selected report fields
    type SelectedReport = typeof allReports[0];

    // Group reports by versionId
    const reportsByVersionId = new Map<string, SelectedReport[]>();
    for (const report of allReports) {
      if (!reportsByVersionId.has(report.bookVersionId)) {
        reportsByVersionId.set(report.bookVersionId, []);
      }
      reportsByVersionId.get(report.bookVersionId)!.push(report);
    }

    // Map versions with their reports (no database queries)
    const versionsWithReports: BookVersionWithReports[] = versions.map((version): BookVersionWithReports => {
        const versionReportsRaw = reportsByVersionId.get(version.id) || [];

        const versionReports = versionReportsRaw.map((report: SelectedReport) => {
          let variant: string | undefined;
          if (report.adminNotes) {
            try {
              const parsed = JSON.parse(report.adminNotes);
              if (typeof parsed?.variant === "string") {
                variant = parsed.variant;
              } else if (parsed?.isPreview) {
                variant = "preview";
              }
            } catch {
              // ignore invalid admin notes
            }
          }
          const { adminNotes, ...rest } = report;
          return { ...rest, variant };
        });

        // Extract summary from the latest completed report
        let extractedSummary: string | null = null;
        const latestCompletedReport = versionReports.find((r) => r.status === "completed");
        if (latestCompletedReport?.htmlContent) {
          extractedSummary = extractSummaryFromReportHtml(latestCompletedReport.htmlContent);
        }

        return {
          ...version,
          reports: versionReports,
          summary: extractedSummary || version.summary, // Use extracted summary if available, fallback to version summary
        };
      });

    // Get all features for this book
    const features = await db
      .select()
      .from(bookFeatures)
      .where(eq(bookFeatures.bookId, id));

    return NextResponse.json({
      ...book[0],
      versions: versionsWithReports,
      features,
    });
  } catch (error) {
    console.error("Failed to fetch book:", error);
    return apiErrors.internal("Failed to fetch book", error);
  }
}

// PATCH /api/books/[id] - Update book details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

  if (!session?.user) {
    return apiErrors.unauthorized();
  }

  // Rate limiting for book update endpoint
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "books:update",
    RATE_LIMITS.API,
    session.user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const contentType = request.headers.get("content-type");
    let title: string;
    let description: string;
    let coverImageUrl: string | undefined;

    if (contentType?.includes("multipart/form-data") || contentType?.includes("boundary=")) {
      const formData = await request.formData();
      const rawTitle = formData.get("title") as string;
      const rawDescription = formData.get("description") as string;
      
      // Sanitize user input to prevent XSS attacks
      const { sanitizeTitle, sanitizeDescription } = await import("@/server/utils/sanitize-input");
      title = sanitizeTitle(rawTitle) || rawTitle; // Fallback to raw if sanitization returns null
      description = sanitizeDescription(rawDescription) || "";

      const coverImage = formData.get("coverImage") as File | null;
      if (coverImage) {
        // Server-side file size validation
        const { validateFileSize } = await import("@/server/utils/validate-file-size");
        const coverSizeValidation = validateFileSize(coverImage);
        if (!coverSizeValidation.isValid) {
          return apiErrors.badRequest(`Cover image: ${coverSizeValidation.error}`, "FILE_TOO_LARGE");
        }

        // Server-side file type validation for cover image
        const { validateImageFileType } = await import("@/server/utils/validate-file-type");
        const coverTypeValidation = validateImageFileType(coverImage);
        if (!coverTypeValidation.isValid) {
          return apiErrors.badRequest(`Cover image: ${coverTypeValidation.error}`, "INVALID_FILE_TYPE");
        }

        // Save cover image to file system (same as POST endpoint)
        // Use process.cwd() to ensure we resolve from project root
        const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
        const coverDir = path.resolve(coverStoragePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(coverDir, { recursive: true });
        
        // Get file extension from MIME type
        const ext = coverImage.type.split('/')[1] || 'jpg';
        const coverFileName = `${id}.${ext}`;
        const coverFilePath = path.join(coverDir, coverFileName);
        
        // Save cover image to disk
        const bytes = await coverImage.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(coverFilePath, buffer);
        
        // Store the API path for serving
        coverImageUrl = `/api/covers/${id}.${ext}`;
      }
    } else {
      const body = await request.json();
      const rawTitle = body.title;
      const rawDescription = body.description;
      
      // Sanitize user input to prevent XSS attacks
      const { sanitizeTitle, sanitizeDescription } = await import("@/server/utils/sanitize-input");
      title = sanitizeTitle(rawTitle) || rawTitle; // Fallback to raw if sanitization returns null
      description = sanitizeDescription(rawDescription) || "";
    }

    // Verify book ownership
    const book = await db
      .select()
      .from(books)
      .where(and(
        eq(books.id, id),
        eq(books.userId, session.user.id)
      ))
      .limit(1);

    if (book.length === 0) {
      return apiErrors.notFound("Book");
    }

    const bookRecord = book[0]!;

    // Update book
    const updateData: {
      title: string;
      description: string;
      updatedAt: Date;
      coverImageUrl?: string;
    } = {
      title: title || bookRecord.title,
      description: description,
      updatedAt: new Date(),
    };

    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    await db
      .update(books)
      .set(updateData)
      .where(eq(books.id, id));

    // Return updated book with all data
    const updatedBook = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get reports for each version
    const versionsWithReports: BookVersionWithReports[] = await Promise.all(
      versions.map(async (version): Promise<BookVersionWithReports> => {
        const versionReports = await db
          .select({
            id: reports.id,
            status: reports.status,
            requestedAt: reports.requestedAt,
            completedAt: reports.completedAt,
            htmlContent: reports.htmlContent,
            pdfUrl: reports.pdfUrl,
          })
          .from(reports)
          .where(eq(reports.bookVersionId, version.id))
          .orderBy(desc(reports.requestedAt));

        // Extract summary from the latest completed report
        let extractedSummary: string | null = null;
        const latestCompletedReport = versionReports.find((r) => r.status === "completed");
        if (latestCompletedReport?.htmlContent) {
          extractedSummary = extractSummaryFromReportHtml(latestCompletedReport.htmlContent);
        }

        return {
          ...version,
          reports: versionReports,
          summary: extractedSummary || version.summary, // Use extracted summary if available, fallback to version summary
        };
      })
    );

    // Get all features for this book
    const features = await db
      .select()
      .from(bookFeatures)
      .where(eq(bookFeatures.bookId, id));

    return NextResponse.json({
      ...updatedBook[0],
      versions: versionsWithReports,
      features,
    });
  } catch (error) {
    console.error("Failed to update book:", error);
    return apiErrors.internal("Failed to update book", error);
  }
}