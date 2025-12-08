import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, marketingAssets } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/marketing-assets/view
 * Admin-only route to view any user's marketing assets
 * Returns the marketing assets HTML content directly
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

    // Get marketing assets - prefer active one, otherwise get HTML one, otherwise any
    const allAssets = await db
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.bookId, bookId));

    // Find active asset using database column
    let activeAsset = allAssets.find(asset => asset.isActive === true);

    // If no active asset, find HTML asset
    if (!activeAsset) {
      activeAsset = allAssets.find(asset => {
        if (!asset.metadata) return false;
        try {
          const metadata = JSON.parse(asset.metadata);
          return metadata.variant === "html";
        } catch {
          return false;
        }
      });
    }

    // If still no active asset, use first asset
    if (!activeAsset && allAssets.length > 0) {
      activeAsset = allAssets[0];
    }

    if (!activeAsset || !activeAsset.metadata) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Marketing Assets Not Found</title>
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
              <h1>Marketing Assets Not Found</h1>
              <p>No marketing assets available for this book.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Parse metadata to get HTML content
    let htmlContent: string | null = null;
    try {
      const metadata = JSON.parse(activeAsset.metadata);
      htmlContent = metadata.htmlContent || null;
    } catch (parseError) {
      console.error('[Admin Marketing Assets View] Failed to parse metadata:', parseError);
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
              <h1>Error</h1>
              <p>Invalid marketing asset metadata.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (!htmlContent) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Marketing Assets Content Missing</title>
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
              <h1>Marketing Assets Content Missing</h1>
              <p>The marketing assets HTML content is not available.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Return HTML directly with proper headers
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[Admin Marketing Assets View] Error:", error);
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
            <h1>Error Loading Marketing Assets</h1>
            <p>Failed to fetch marketing assets HTML: ${errorMessage}</p>
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

