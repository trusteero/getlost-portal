import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  const isAdmin = session.user.role === "admin" || adminEmails.includes(session.user.email || "");

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { status } = await request.json();

    if (!["not_requested", "requested", "analyzing", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Get the latest version of the book
    const [latestVersion] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json({ error: "No book version found" }, { status: 404 });
    }

    // Check if there's an existing report
    const [existingReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    if (status === "not_requested") {
      // If setting to not_requested, delete the report if it exists
      if (existingReport) {
        await db
          .delete(reports)
          .where(eq(reports.id, existingReport.id));
      }
    } else {
      // Map the status to the database schema
      const dbStatus = status === "requested" ? "pending" : status;

      if (existingReport) {
        // Update existing report
        await db
          .update(reports)
          .set({
            status: dbStatus,
            ...(status === "analyzing" && { startedAt: new Date() }),
            ...(status === "completed" && { completedAt: new Date() }),
          })
          .where(eq(reports.id, existingReport.id));
      } else {
        // Create new report
        await db
          .insert(reports)
          .values({
            bookVersionId: latestVersion.id,
            status: dbStatus,
            requestedAt: new Date(),
            ...(status === "analyzing" && { startedAt: new Date() }),
            ...(status === "completed" && { completedAt: new Date() }),
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update report status:", error);
    return NextResponse.json(
      { error: "Failed to update report status" },
      { status: 500 }
    );
  }
}