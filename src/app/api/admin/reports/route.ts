import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { reports, bookVersions, books, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
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
    // Get all reports with related data
    const allReports = await db
      .select({
        id: reports.id,
        status: reports.status,
        requestedAt: reports.requestedAt,
        startedAt: reports.startedAt,
        completedAt: reports.completedAt,
        analyzedBy: reports.analyzedBy,
        bookVersion: {
          id: bookVersions.id,
          fileName: bookVersions.fileName,
          fileUrl: bookVersions.fileUrl,
          book: {
            id: books.id,
            title: books.title,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
            },
          },
        },
      })
      .from(reports)
      .innerJoin(bookVersions, eq(reports.bookVersionId, bookVersions.id))
      .innerJoin(books, eq(bookVersions.bookId, books.id))
      .innerJoin(users, eq(books.userId, users.id))
      .orderBy(desc(reports.requestedAt));

    // Check if notifications were sent (simplified for now)
    const reportsWithNotificationStatus = allReports.map(report => ({
      ...report,
      notificationSent: report.status === "completed" && report.completedAt !== null,
    }));

    return NextResponse.json(reportsWithNotificationStatus);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}