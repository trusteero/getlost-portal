import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id: bookId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [book] = await db
      .select({
        id: books.id,
        userId: books.userId,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book || book.userId !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const [latestVersion] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, bookId))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json({ error: "No book version found" }, { status: 404 });
    }

    const [previewReport] = await db
      .select({
        id: reports.id,
        htmlContent: reports.htmlContent,
      })
      .from(reports)
      .where(
        and(
          eq(reports.bookVersionId, latestVersion.id),
          eq(reports.status, "preview")
        )
      )
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    if (!previewReport || !previewReport.htmlContent) {
      return NextResponse.json(
        { error: "Preview not available for this book" },
        { status: 404 }
      );
    }

    // Update viewedAt timestamp when user views the preview report
    await db
      .update(reports)
      .set({ viewedAt: new Date() })
      .where(eq(reports.id, previewReport.id));

    return new NextResponse(previewReport.htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Failed to fetch preview HTML:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview HTML" },
      { status: 500 }
    );
  }
}

