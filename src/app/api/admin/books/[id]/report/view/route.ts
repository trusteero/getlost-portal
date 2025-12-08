import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * GET /api/admin/books/[id]/report/view
 * Admin-only route to view any user's report
 * Returns the report HTML content directly (not as JSON)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unauthorized</title>
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
            <h1>Unauthorized</h1>
            <p>Please sign in to view this report.</p>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Check if user is admin
  const currentUserRole = (session.user as any)?.role;
  if (currentUserRole !== "admin" && currentUserRole !== "super_admin") {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Forbidden</title>
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
            <h1>Forbidden</h1>
            <p>Admin access required to view this report.</p>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    // Get the book (no ownership check for admin)
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
        userId: books.userId,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Book Not Found</title>
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
              <h1>Book Not Found</h1>
              <p>The requested book could not be found.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Get the latest version of the book
    const [latestVersion] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, bookId))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>No Book Version</title>
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
              <h1>No Book Version Found</h1>
              <p>This book has no uploaded versions.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Get all completed reports for this version (filter out preview)
    const allReports = await db
      .select({
        id: reports.id,
        status: reports.status,
        htmlContent: reports.htmlContent,
        requestedAt: reports.requestedAt,
        completedAt: reports.completedAt,
        adminNotes: reports.adminNotes,
      })
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.completedAt), desc(reports.requestedAt));

    // Filter out preview reports (check status and adminNotes for variant)
    const fullReports = allReports.filter((r: any) => {
      if (r.status === "preview") return false;
      // Check adminNotes for variant if it exists
      if (r.adminNotes) {
        try {
          const notes = typeof r.adminNotes === 'string' ? JSON.parse(r.adminNotes) : r.adminNotes;
          if (notes.variant === "preview") return false;
        } catch {
          // Ignore parse errors
        }
      }
      return true;
    });

    if (fullReports.length === 0) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Report Not Available</title>
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
              <h1>Report Not Available</h1>
              <p>No completed report found for this book.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Use the most recent completed report
    const report = fullReports[0]!;

    if (!report.htmlContent) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Report Content Missing</title>
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
              <h1>Report Content Missing</h1>
              <p>The report HTML content is not available.</p>
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
    return new NextResponse(report.htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("[Admin Report View] Error:", error);
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
            <h1>Error Loading Report</h1>
            <p>Failed to fetch report HTML: ${errorMessage}</p>
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

