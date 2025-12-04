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

    // Get target user - check if password column exists first
    const { columnExists } = await import("@/server/db/migrations");
    const hasPasswordColumn = columnExists("getlostportal_user", "password");
    
    let targetUser;
    if (hasPasswordColumn) {
      targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    } else {
      targetUser = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          image: users.image,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    }

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
      try {
        // Delete summaries (if table exists)
        await db.delete(summaries).where(eq(summaries.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete summaries for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete landing pages
        await db.delete(landingPages).where(eq(landingPages.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete landing pages for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete book covers
        await db.delete(bookCovers).where(eq(bookCovers.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete book covers for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete marketing assets
        await db.delete(marketingAssets).where(eq(marketingAssets.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete marketing assets for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete purchases
        await db.delete(purchases).where(eq(purchases.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete purchases for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete book features
        await db.delete(bookFeatures).where(eq(bookFeatures.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete book features for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete digest jobs
        await db.delete(digestJobs).where(eq(digestJobs.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete digest jobs for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete reports (via book versions)
        const bookVersionsList = await db
          .select({ id: bookVersions.id })
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id));
        
        const versionIds = bookVersionsList.map(v => v.id);
        
        for (const versionId of versionIds) {
          try {
            await db.delete(reports).where(eq(reports.bookVersionId, versionId));
          } catch (error: any) {
            if (!error.message?.includes("no such table")) {
              console.warn(`Failed to delete reports for version ${versionId}:`, error.message);
            }
          }
        }
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to get book versions for book ${book.id}:`, error.message);
        }
      }

      try {
        // Delete book versions
        await db.delete(bookVersions).where(eq(bookVersions.bookId, book.id));
      } catch (error: any) {
        if (!error.message?.includes("no such table")) {
          console.warn(`Failed to delete book versions for book ${book.id}:`, error.message);
        }
      }
    }

    // 3. Delete all books for this user
    try {
      await db.delete(books).where(eq(books.userId, userId));
    } catch (error: any) {
      console.warn("Failed to delete books:", error.message);
      throw error; // This is critical, so throw
    }

    // 4. Delete purchases (in case any remain)
    try {
      await db.delete(purchases).where(eq(purchases.userId, userId));
    } catch (error: any) {
      if (!error.message?.includes("no such table")) {
        console.warn("Failed to delete purchases:", error.message);
      }
    }

    // 5. Delete notifications
    try {
      await db.delete(notifications).where(eq(notifications.userId, userId));
    } catch (error: any) {
      if (!error.message?.includes("no such table")) {
        console.warn("Failed to delete notifications:", error.message);
      }
    }

    // 6. Delete verification tokens (Better Auth uses identifier field)
    try {
      await db.delete(verificationTokens).where(eq(verificationTokens.identifier, target.email));
    } catch (error: any) {
      if (!error.message?.includes("no such table")) {
        console.warn("Failed to delete verification tokens:", error.message);
      }
    }

    // 7. Delete sessions (Better Auth schema uses userId field which maps to user_id column)
    try {
      await db.delete(betterAuthSession).where(eq(betterAuthSession.userId, userId));
    } catch (error: any) {
      if (!error.message?.includes("no such table") && !error.message?.includes("no such column")) {
        console.warn("Failed to delete sessions:", error.message);
      }
    }

    // 8. Delete accounts (OAuth accounts - Better Auth schema uses userId field which maps to user_id column)
    try {
      await db.delete(betterAuthAccount).where(eq(betterAuthAccount.userId, userId));
    } catch (error: any) {
      if (!error.message?.includes("no such table") && !error.message?.includes("no such column")) {
        console.warn("Failed to delete accounts:", error.message);
      }
    }

    // 9. Finally, delete the user
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch (error: any) {
      console.error("Failed to delete user:", error.message);
      throw error; // This is critical, so throw
    }

    return NextResponse.json({ 
      success: true,
      message: "User and all related data deleted successfully"
    });
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete user", details: error.message || String(error) },
      { status: 500 }
    );
  }
}

