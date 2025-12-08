import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, landingPages } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/landing-page/view
 * Admin-only route to view any user's landing page
 * Returns the landing page HTML content directly
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

    // Get landing page - prefer active one
    let landingPage = await db
      .select()
      .from(landingPages)
      .where(
        and(
          eq(landingPages.bookId, bookId),
          eq(landingPages.isActive, true)
        )
      )
      .limit(1);

    // If no active landing page, get any landing page
    if (landingPage.length === 0) {
      landingPage = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.bookId, bookId))
        .limit(1);
    }

    if (landingPage.length === 0 || !landingPage[0]) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Landing Page Not Found</title>
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
              <h1>Landing Page Not Found</h1>
              <p>No landing page available for this book.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const page = landingPage[0];

    if (!page.htmlContent) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Landing Page Content Missing</title>
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
              <h1>Landing Page Content Missing</h1>
              <p>The landing page HTML content is not available.</p>
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
    return new NextResponse(page.htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[Admin Landing Page View] Error:", error);
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
            <h1>Error Loading Landing Page</h1>
            <p>Failed to fetch landing page HTML: ${errorMessage}</p>
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

