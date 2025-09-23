import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { notifications, reports, bookVersions, books } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  if (session.user.role !== "admin" && !adminEmails.includes(session.user.email || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { reportId, userId, type } = await request.json();

    if (!reportId || !userId || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get report and book details
    const reportDetails = await db
      .select({
        reportId: reports.id,
        bookTitle: books.title,
        bookId: books.id,
      })
      .from(reports)
      .innerJoin(bookVersions, eq(reports.bookVersionId, bookVersions.id))
      .innerJoin(books, eq(bookVersions.bookId, books.id))
      .where(eq(reports.id, reportId))
      .limit(1);

    if (reportDetails.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Create notification
    await db
      .insert(notifications)
      .values({
        userId,
        type,
        title: "Your analysis report is ready!",
        message: `The analysis report for "${reportDetails[0].bookTitle}" has been completed and is now available for viewing.`,
        data: JSON.stringify({
          reportId,
          bookId: reportDetails[0].bookId,
        }),
        read: false,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}