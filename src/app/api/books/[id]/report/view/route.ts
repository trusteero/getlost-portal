import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports, bookFeatures, purchases } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/report/view
 * Returns the report HTML content directly (not as JSON)
 * This avoids JSON response size limits for large HTML files
 * Bundles images on-the-fly if not already bundled
 * 
 * Requires: manuscript-report feature to be unlocked
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

  try {
    // Verify the user owns this book
    const [book] = await db
      .select({
        id: books.id,
        userId: books.userId,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book || book.userId !== session.user.id) {
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

    // Get the latest version of the book first
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

    // Get all completed reports for this version FIRST
    // If a completed report exists (admin uploaded it), allow viewing regardless of purchase status
    const completedReports = await db
      .select({
        id: reports.id,
        htmlContent: reports.htmlContent,
        adminNotes: reports.adminNotes,
      })
      .from(reports)
      .where(and(
        eq(reports.bookVersionId, latestVersion.id),
        eq(reports.status, "completed")
      ))
      .orderBy(desc(reports.requestedAt));

    // Get all reports for this version (for debugging)
    const allReports = await db
      .select({
        id: reports.id,
        status: reports.status,
        htmlContent: reports.htmlContent,
        requestedAt: reports.requestedAt,
        completedAt: reports.completedAt,
      })
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.requestedAt));

    console.log(`[Report View] Found ${allReports.length} report(s) for version ${latestVersion.id}:`, 
      allReports.map(r => ({ id: r.id, status: r.status, hasHtml: !!r.htmlContent })));

    // If a completed report exists with HTML content, allow viewing (admin has uploaded it)
    const hasCompletedReport = completedReports.length > 0 && completedReports.some(r => r.htmlContent);

    // Check if manuscript-report feature is unlocked (only if no completed report exists)
    let isUnlocked = hasCompletedReport; // If admin uploaded report, it's unlocked

    if (!isUnlocked) {
      // Only check purchase/feature if no completed report exists
      const [feature] = await db
        .select()
        .from(bookFeatures)
        .where(
          and(
            eq(bookFeatures.bookId, bookId),
            eq(bookFeatures.featureType, "manuscript-report")
          )
        )
        .limit(1);

      // Also check if there's a purchase record (completed or pending)
      const [anyPurchase] = await db
        .select()
        .from(purchases)
        .where(
          and(
            eq(purchases.bookId, bookId),
            eq(purchases.featureType, "manuscript-report")
          )
        )
        .orderBy(desc(purchases.createdAt))
        .limit(1);

      // Feature is unlocked if:
      // 1. Feature exists and status is not "locked", OR
      // 2. There's a purchase record (pending or completed) - indicates payment was initiated
      isUnlocked = (feature && feature.status !== "locked") || (anyPurchase !== undefined);

      console.log(`[Report View] Book ${bookId} unlock check:`, {
        hasCompletedReport,
        hasFeature: !!feature,
        featureStatus: feature?.status,
        hasPurchase: !!anyPurchase,
        purchaseStatus: anyPurchase?.status,
        purchaseId: anyPurchase?.id,
        isUnlocked,
      });
    } else {
      console.log(`[Report View] Book ${bookId}: Completed report exists, allowing access`);
    }

    if (!isUnlocked) {
      // Return HTML error page instead of JSON for iframe compatibility
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
              <p>Please purchase the manuscript report first.</p>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Find active report
    let report = completedReports.find(r => {
      if (!r.adminNotes) return false;
      try {
        const notes = JSON.parse(r.adminNotes);
        return notes.isActive === true;
      } catch {
        return false;
      }
    });

    // If no active report, use the latest one
    if (!report) {
      report = completedReports[0] || undefined;
    }

    if (!report || !report.htmlContent) {
      // Provide more detailed error information
      const hasAnyReport = allReports.length > 0;
      const hasCompletedReport = allReports.some(r => r.status === "completed");
      const hasReportWithoutHtml = completedReports.some(r => !r.htmlContent);
      
      let errorMessage = "No completed report found.";
      if (!hasAnyReport) {
        errorMessage += " No reports exist for this book version. Please upload a report or run the seed script.";
      } else if (!hasCompletedReport) {
        const statuses = allReports.map(r => r.status).join(", ");
        errorMessage += ` Found ${allReports.length} report(s) but none are completed. Status(es): ${statuses}`;
      } else if (hasReportWithoutHtml) {
        errorMessage += " Report exists but has no HTML content in database. Please re-upload the report via admin interface or run the seed script.";
      } else {
        errorMessage += " The report may still be processing or hasn't been uploaded yet.";
      }
      
      // Return HTML error page instead of JSON for iframe compatibility
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
                max-width: 600px;
              }
              h1 { color: #dc2626; margin-bottom: 0.5rem; }
              p { color: #6b7280; margin-bottom: 1rem; }
              .debug {
                margin-top: 1rem;
                padding: 1rem;
                background: #f3f4f6;
                border-radius: 0.5rem;
                font-size: 0.875rem;
                text-align: left;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>Report Not Available</h1>
              <p>${errorMessage}</p>
              <div class="debug">
                <strong>Debug Info:</strong><br/>
                Version ID: ${latestVersion.id}<br/>
                Report Count: ${allReports.length}<br/>
                Statuses: ${allReports.map(r => `${r.id}: ${r.status} (hasHtml: ${!!r.htmlContent})`).join(', ')}
              </div>
            </div>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // HTML content should already be bundled with images when stored in database
    // All data comes from database, no file system access needed
    const htmlContent = report.htmlContent;

    // Update viewedAt timestamp when user views the report
    // Drizzle's mode: "timestamp" expects a Date object
    await db
      .update(reports)
      .set({ viewedAt: new Date() })
      .where(eq(reports.id, report.id));
    
    console.log(`[Report View] Updated viewedAt for report ${report.id} to ${new Date().toISOString()}`);

    // Return HTML directly with proper headers
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("Failed to fetch report HTML:", error);
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

