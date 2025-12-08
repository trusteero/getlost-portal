import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookCovers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/covers/view
 * Admin-only route to view any user's book covers
 * Returns the covers HTML content directly if available, or JSON for image-based covers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUserRole = (session.user as any)?.role;
  if (currentUserRole !== "admin" && currentUserRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get the book (no ownership check for admin)
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get book covers - prefer primary one, otherwise get HTML one, otherwise any
    const allCovers = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.bookId, bookId));

    // Find primary cover
    let primaryCover = allCovers.find(cover => cover.isPrimary);

    // If no primary cover, find HTML cover
    if (!primaryCover) {
      primaryCover = allCovers.find(cover => {
        if (!cover.metadata) return false;
        try {
          const metadata = JSON.parse(cover.metadata);
          return metadata.variant === "html";
        } catch {
          return false;
        }
      });
    }

    // If still no primary cover, use first cover
    if (!primaryCover && allCovers.length > 0) {
      primaryCover = allCovers[0];
    }

    if (!primaryCover) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Book Covers Not Found</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f9fafb;
                color: #374151;
              }
              .error-container {
                text-align: center;
                padding: 2rem;
              }
              h1 { color: #dc2626; margin-bottom: 0.5rem; }
              p { color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>Book Covers Not Found</h1>
              <p>No book covers available for this book.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Check if it's an HTML-based cover gallery
    if (primaryCover.metadata) {
      try {
        const metadata = JSON.parse(primaryCover.metadata);
        if (metadata.variant === "html" && metadata.htmlContent) {
          // Return HTML directly
          return new NextResponse(metadata.htmlContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      } catch (parseError) {
        // Not HTML, continue to image-based view
      }
    }

    // For image-based covers, redirect to the image URL or return JSON
    // Since we're in an admin view route, we'll return a simple HTML page with the cover image
    const imageUrl = primaryCover.imageUrl || primaryCover.thumbnailUrl;
    if (imageUrl) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${primaryCover.title || 'Book Cover'}</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f9fafb;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="${primaryCover.title || 'Book Cover'}" />
          </body>
        </html>
      `;
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cover Content Missing</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f9fafb;
              color: #374151;
            }
            .error-container {
              text-align: center;
              padding: 2rem;
            }
            h1 { color: #dc2626; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Cover Content Missing</h1>
            <p>The book cover content is not available.</p>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error("[Admin Covers View] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f9fafb;
              color: #374151;
            }
            .error-container {
              text-align: center;
              padding: 2rem;
            }
            h1 { color: #dc2626; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Error Loading Covers</h1>
            <p>Failed to fetch covers: ${errorMessage}</p>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

