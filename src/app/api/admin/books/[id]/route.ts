import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { 
  books, 
  bookVersions, 
  reports, 
  digestJobs, 
  bookFeatures, 
  purchases,
  marketingAssets,
  bookCovers,
  landingPages,
  summaries
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import { promises as fs } from "fs";

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id: bookId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const contentType = request.headers.get("content-type");
    let title: string | null = null;
    let description: string | null = null;
    let coverImageUrl: string | null = null;

    // Handle multipart/form-data (for file uploads)
    if (contentType?.includes("multipart/form-data") || contentType?.includes("boundary=")) {
      const formData = await request.formData();
      const rawTitle = formData.get("title") as string | null;
      const rawDescription = formData.get("description") as string | null;
      const coverImage = formData.get("coverImage") as File | null;

      // Sanitize user input to prevent XSS attacks
      const { sanitizeTitle, sanitizeDescription } = await import("@/server/utils/sanitize-input");
      if (rawTitle) {
        title = sanitizeTitle(rawTitle);
      }
      if (rawDescription) {
        description = sanitizeDescription(rawDescription);
      }

      // Handle cover image upload
      if (coverImage) {
        // Server-side file size validation
        const { validateFileSize } = await import("@/server/utils/validate-file-size");
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

        // Save cover image to file system
        const { promises: fs } = await import("fs");
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
        
        console.log(`[Admin API] Saved cover image to: ${coverFilePath}`);
        
        // Store the API path for serving
        coverImageUrl = `/api/covers/${bookId}.${ext}`;
      }
    } else {
      // Handle JSON body
      const body = await request.json();
      const { title: rawTitle, description: rawDescription, coverImageUrl: url } = body;

      // Sanitize user input to prevent XSS attacks
      const { sanitizeTitle, sanitizeDescription } = await import("@/server/utils/sanitize-input");
      if (rawTitle !== undefined) {
        title = sanitizeTitle(rawTitle);
      }
      if (rawDescription !== undefined) {
        description = sanitizeDescription(rawDescription);
      }

      // Allow updating coverImageUrl (for setting a specific cover as the primary display image)
      if (url !== undefined) {
        coverImageUrl = url || null;
      }
    }

    // Verify book exists
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Update book
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== null) {
      updateData.title = title;
    }

    if (description !== null) {
      updateData.description = description;
    }

    if (coverImageUrl !== null) {
      updateData.coverImageUrl = coverImageUrl;
    }

    await db
      .update(books)
      .set(updateData)
      .where(eq(books.id, bookId));

    // Return updated book
    const [updatedBook] = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error("[Admin] Failed to update book:", error);
    console.error("[Admin] Update book error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bookId,
    });
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id: bookId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Verify book exists
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Delete in order to respect foreign key constraints
    // 1. Delete summaries
    await db.delete(summaries).where(eq(summaries.bookId, bookId));

    // 2. Delete landing pages
    await db.delete(landingPages).where(eq(landingPages.bookId, bookId));

    // 3. Delete book covers
    await db.delete(bookCovers).where(eq(bookCovers.bookId, bookId));

    // 4. Delete marketing assets
    await db.delete(marketingAssets).where(eq(marketingAssets.bookId, bookId));

    // 5. Delete purchases
    await db.delete(purchases).where(eq(purchases.bookId, bookId));

    // 6. Delete book features
    await db.delete(bookFeatures).where(eq(bookFeatures.bookId, bookId));

    // 7. Delete digest jobs
    await db.delete(digestJobs).where(eq(digestJobs.bookId, bookId));

    // 8. Delete reports (via book versions)
    // Get all book versions for this book
    const bookVersionsList = await db
      .select({ id: bookVersions.id })
      .from(bookVersions)
      .where(eq(bookVersions.bookId, bookId));
    
    const versionIds = bookVersionsList.map(v => v.id);
    
    for (const versionId of versionIds) {
      await db.delete(reports).where(eq(reports.bookVersionId, versionId));
    }

    // 9. Delete book versions
    await db.delete(bookVersions).where(eq(bookVersions.bookId, bookId));

    // 10. Finally, delete the book
    await db.delete(books).where(eq(books.id, bookId));

    return NextResponse.json({ 
      success: true,
      message: "Book and all related data deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete book:", error);
    return NextResponse.json(
      { error: "Failed to delete book" },
      { status: 500 }
    );
  }
}

