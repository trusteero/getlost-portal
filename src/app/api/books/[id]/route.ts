import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get book details
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, params.id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check if user owns the book
    if (book[0].userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all versions
    const versions = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, params.id))
      .orderBy(desc(bookVersions.uploadedAt));

    // Get reports for each version
    const versionsWithReports = await Promise.all(
      versions.map(async (version) => {
        const versionReports = await db
          .select({
            id: reports.id,
            status: reports.status,
            requestedAt: reports.requestedAt,
            completedAt: reports.completedAt,
            htmlContent: reports.htmlContent,
            pdfUrl: reports.pdfUrl,
          })
          .from(reports)
          .where(eq(reports.bookVersionId, version.id))
          .orderBy(desc(reports.requestedAt));

        return {
          ...version,
          reports: versionReports,
        };
      })
    );

    return NextResponse.json({
      ...book[0],
      versions: versionsWithReports,
    });
  } catch (error) {
    console.error("Failed to fetch book:", error);
    return NextResponse.json({ error: "Failed to fetch book" }, { status: 500 });
  }
}