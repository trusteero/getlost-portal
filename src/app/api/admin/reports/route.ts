import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports, bookVersions, books, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all reports with related data
    const allReportsFlat = await db
      .select({
        id: reports.id,
        status: reports.status,
        requestedAt: reports.requestedAt,
        startedAt: reports.startedAt,
        completedAt: reports.completedAt,
        analyzedBy: reports.analyzedBy,
        bookVersionId: bookVersions.id,
        bookVersionFileName: bookVersions.fileName,
        bookVersionFileUrl: bookVersions.fileUrl,
        bookId: books.id,
        bookTitle: books.title,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(reports)
      .innerJoin(bookVersions, eq(reports.bookVersionId, bookVersions.id))
      .innerJoin(books, eq(bookVersions.bookId, books.id))
      .innerJoin(users, eq(books.userId, users.id))
      .orderBy(desc(reports.requestedAt));

    // Transform flat data to nested structure
    const allReports = allReportsFlat.map((report: any) => ({
      id: report.id,
      status: report.status,
      requestedAt: report.requestedAt,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      analyzedBy: report.analyzedBy,
      bookVersion: {
        id: report.bookVersionId,
        fileName: report.bookVersionFileName,
        fileUrl: report.bookVersionFileUrl,
        book: {
          id: report.bookId,
          title: report.bookTitle,
          user: {
            id: report.userId,
            name: report.userName,
            email: report.userEmail,
          },
        },
      },
    }));

    // Check if notifications were sent (simplified for now)
    const reportsWithNotificationStatus = allReports.map((report: any) => ({
      ...report,
      notificationSent: report.status === "completed" && report.completedAt !== null,
    }));

    return NextResponse.json(reportsWithNotificationStatus);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}