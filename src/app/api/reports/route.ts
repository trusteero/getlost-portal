import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { reports, bookVersions, books } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bookVersionId } = await request.json();

    if (!bookVersionId) {
      return NextResponse.json({ error: "Book version ID is required" }, { status: 400 });
    }

    // Verify user owns the book version
    const version = await db
      .select({
        versionId: bookVersions.id,
        bookId: bookVersions.bookId,
        userId: books.userId,
      })
      .from(bookVersions)
      .innerJoin(books, eq(bookVersions.bookId, books.id))
      .where(eq(bookVersions.id, bookVersionId))
      .limit(1);

    if (version.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const versionData = version[0]!;

    if (versionData.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if report already exists
    const existingReport = await db
      .select()
      .from(reports)
      .where(eq(reports.bookVersionId, bookVersionId))
      .limit(1);

    if (existingReport.length > 0) {
      return NextResponse.json({ error: "Report already exists for this version" }, { status: 400 });
    }

    // Create new report (fake payment processing assumed)
    const newReport = await db
      .insert(reports)
      .values({
        bookVersionId,
        status: "pending",
      })
      .returning();

    return NextResponse.json(newReport[0]);
  } catch (error) {
    console.error("Failed to create report:", error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}