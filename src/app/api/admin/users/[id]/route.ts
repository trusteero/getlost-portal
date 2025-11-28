import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { 
  users,
  books,
  bookVersions,
  reports,
  digestJobs,
  bookFeatures,
  purchases,
  marketingAssets,
  bookCovers,
  landingPages,
  summaries,
  notifications,
  verificationTokens
} from "@/server/db/schema";
import { session as betterAuthSession, account as betterAuthAccount } from "@/server/db/better-auth-schema";
import { eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin or super_admin
  const currentUserRole = (session.user as any)?.role;
  if (currentUserRole !== "admin" && currentUserRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: userId } = await params;

    // Get target user
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const target = targetUser[0]!;

    // Prevent deleting yourself
    if (target.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 403 }
      );
    }

    // Only super_admins can delete super_admins
    if (target.role === "super_admin" && currentUserRole !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can delete super admin accounts" },
        { status: 403 }
      );
    }

    // Delete in order to respect foreign key constraints
    // 1. Get all books for this user
    const userBooks = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.userId, userId));

    // 2. For each book, delete all related data (same as book deletion)
    for (const book of userBooks) {
      // Delete summaries
      await db.delete(summaries).where(eq(summaries.bookId, book.id));

      // Delete landing pages
      await db.delete(landingPages).where(eq(landingPages.bookId, book.id));

      // Delete book covers
      await db.delete(bookCovers).where(eq(bookCovers.bookId, book.id));

      // Delete marketing assets
      await db.delete(marketingAssets).where(eq(marketingAssets.bookId, book.id));

      // Delete purchases
      await db.delete(purchases).where(eq(purchases.bookId, book.id));

      // Delete book features
      await db.delete(bookFeatures).where(eq(bookFeatures.bookId, book.id));

      // Delete digest jobs
      await db.delete(digestJobs).where(eq(digestJobs.bookId, book.id));

      // Delete reports (via book versions)
      const bookVersionsList = await db
        .select({ id: bookVersions.id })
        .from(bookVersions)
        .where(eq(bookVersions.bookId, book.id));
      
      const versionIds = bookVersionsList.map(v => v.id);
      
      for (const versionId of versionIds) {
        await db.delete(reports).where(eq(reports.bookVersionId, versionId));
      }

      // Delete book versions
      await db.delete(bookVersions).where(eq(bookVersions.bookId, book.id));
    }

    // 3. Delete all books for this user
    await db.delete(books).where(eq(books.userId, userId));

    // 4. Delete purchases (in case any remain)
    await db.delete(purchases).where(eq(purchases.userId, userId));

    // 5. Delete notifications
    await db.delete(notifications).where(eq(notifications.userId, userId));

    // 6. Delete verification tokens (Better Auth uses identifier field)
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, target.email));

    // 7. Delete sessions (Better Auth schema uses userId field which maps to user_id column)
    await db.delete(betterAuthSession).where(eq(betterAuthSession.userId, userId));

    // 8. Delete accounts (OAuth accounts - Better Auth schema uses userId field which maps to user_id column)
    await db.delete(betterAuthAccount).where(eq(betterAuthAccount.userId, userId));

    // 9. Finally, delete the user
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ 
      success: true,
      message: "User and all related data deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

