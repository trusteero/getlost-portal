import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports, bookVersions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id: bookId, reportId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Verify the report belongs to a version of this book
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Verify the book version belongs to this book
    const [version] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.id, report.bookVersionId))
      .limit(1);

    if (!version || version.bookId !== bookId) {
      return NextResponse.json({ error: "Report not found for this book" }, { status: 404 });
    }

    await db.delete(reports).where(eq(reports.id, reportId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete report:", error);
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id: bookId, reportId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { isActive } = await request.json();

    // Verify the report belongs to a version of this book
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Verify the book version belongs to this book
    const [version] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.id, report.bookVersionId))
      .limit(1);

    if (!version || version.bookId !== bookId) {
      return NextResponse.json({ error: "Report not found for this book" }, { status: 404 });
    }

    // If setting as active, unset other active reports for this version
    if (isActive) {
      const allReports = await db
        .select()
        .from(reports)
        .where(eq(reports.bookVersionId, version.id));

      for (const r of allReports) {
        if (r.id !== reportId && r.adminNotes) {
          try {
            const notes = JSON.parse(r.adminNotes);
            if (notes.isActive) {
              await db
                .update(reports)
                .set({
                  adminNotes: JSON.stringify({
                    ...notes,
                    isActive: false
                  })
                })
                .where(eq(reports.id, r.id));
            }
          } catch {
            // Ignore invalid admin notes
          }
        }
      }
    }

    // Update this report
    const adminNotes = report.adminNotes ? JSON.parse(report.adminNotes) : {};
    await db
      .update(reports)
      .set({
        adminNotes: JSON.stringify({
          ...adminNotes,
          isActive: isActive || false
        })
      })
      .where(eq(reports.id, reportId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}

