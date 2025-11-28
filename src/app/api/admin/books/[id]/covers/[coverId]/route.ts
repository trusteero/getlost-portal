import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { bookCovers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; coverId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id, coverId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db
      .delete(bookCovers)
      .where(
        and(
          eq(bookCovers.id, coverId),
          eq(bookCovers.bookId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete cover:", error);
    return NextResponse.json(
      { error: "Failed to delete cover" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; coverId: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id, coverId } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { isPrimary } = body;

    // If setting as primary, unset all other primary covers for this book
    if (isPrimary === true) {
      await db
        .update(bookCovers)
        .set({ isPrimary: false })
        .where(eq(bookCovers.bookId, id));
    }

    // Update this cover
    await db
      .update(bookCovers)
      .set({
        isPrimary: isPrimary === true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookCovers.id, coverId),
          eq(bookCovers.bookId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update cover:", error);
    return NextResponse.json(
      { error: "Failed to update cover" },
      { status: 500 }
    );
  }
}

