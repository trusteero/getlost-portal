import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user owns the book
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, params.id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book[0].userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Get the latest version number
    const latestVersion = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, params.id))
      .orderBy(desc(bookVersions.versionNumber))
      .limit(1);

    const nextVersionNumber = latestVersion.length > 0 ? latestVersion[0].versionNumber + 1 : 1;

    // TODO: Upload file to storage
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;
    const fileUrl = `/uploads/${params.id}/v${nextVersionNumber}/${fileName}`;

    // Create new version
    const newVersion = await db
      .insert(bookVersions)
      .values({
        bookId: params.id,
        versionNumber: nextVersionNumber,
        fileName,
        fileUrl,
        fileSize,
        fileType,
      })
      .returning();

    return NextResponse.json(newVersion[0]);
  } catch (error) {
    console.error("Failed to create book version:", error);
    return NextResponse.json({ error: "Failed to create book version" }, { status: 500 });
  }
}