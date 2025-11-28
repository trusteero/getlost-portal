import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { user as betterAuthUser } from "@/server/db/better-auth-schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["queued", "working_on", "ready_to_purchase"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'queued', 'working_on', or 'ready_to_purchase'" },
        { status: 400 }
      );
    }

    // Get book details before updating
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    await db
      .update(books)
      .set({
        manuscriptStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(books.id, id));

    // Send notification email when status changes to "working_on"
    if (status === "working_on") {
      try {
        const { sendManuscriptInProgressEmail } = await import("@/server/services/email");
        const [userData] = await db
          .select({ email: betterAuthUser.email, name: betterAuthUser.name })
          .from(betterAuthUser)
          .where(eq(betterAuthUser.id, book.userId))
          .limit(1);
        
        if (userData?.email) {
          await sendManuscriptInProgressEmail(
            userData.email,
            book.title || "Untitled",
            userData.name || undefined
          );
          console.log(`[Email] Sent manuscript in progress notification to ${userData.email}`);
        }
      } catch (error) {
        // Don't fail status update if email fails
        console.error("[Email] Failed to send manuscript in progress notification:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update manuscript status:", error);
    return NextResponse.json({ error: "Failed to update manuscript status" }, { status: 500 });
  }
}

