import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { digestJobs, books, notifications, users } from "@/server/db/schema";
import { eq, and, or } from "drizzle-orm";
import { checkBookDigestStatus } from "@/server/services/bookdigest";

// This endpoint should be called periodically (e.g., every minute via a cron job)
// For now, it can be called from the client side when books are being viewed
export async function POST(request: NextRequest) {
  try {
    // Get all processing jobs
    const processingJobs = await db
      .select({
        id: digestJobs.id,
        bookId: digestJobs.bookId,
        externalJobId: digestJobs.externalJobId,
        status: digestJobs.status,
        attempts: digestJobs.attempts,
      })
      .from(digestJobs)
      .where(
        or(
          eq(digestJobs.status, "processing"),
          eq(digestJobs.status, "pending")
        )
      )
      .limit(10); // Process 10 at a time

    const updatedJobs = [];

    for (const job of processingJobs) {
      try {
        // Check status from external service
        const result = await checkBookDigestStatus(job.id);

        // If completed, create a notification
        if (result.status === "completed") {
          // Get book and user info
          const [book] = await db
            .select({
              title: books.title,
              userId: books.userId,
            })
            .from(books)
            .where(eq(books.id, job.bookId))
            .limit(1);

          if (book) {
            // Create notification for user
            await db.insert(notifications).values({
              userId: book.userId,
              type: "processing_completed",
              title: "Book Processing Complete",
              message: `"${book.title}" has been successfully analyzed and is ready to view.`,
              data: JSON.stringify({ bookId: job.bookId }),
              read: false,
            });
          }

          updatedJobs.push({
            id: job.id,
            status: "completed",
            bookId: job.bookId,
          });
        } else if (result.status === "failed") {
          // Get book and user info for failure notification
          const [failedBook] = await db
            .select({
              title: books.title,
              userId: books.userId,
            })
            .from(books)
            .where(eq(books.id, job.bookId))
            .limit(1);

          if (failedBook) {
            await db.insert(notifications).values({
              userId: failedBook.userId,
              type: "processing_failed",
              title: "Book Processing Failed",
              message: `Processing failed for "${failedBook.title}". Please try uploading again.`,
              data: JSON.stringify({ bookId: job.bookId }),
              read: false,
            });
          }

          updatedJobs.push({
            id: job.id,
            status: "failed",
            bookId: job.bookId,
          });
        } else {
          updatedJobs.push({
            id: job.id,
            status: result.status,
            bookId: job.bookId,
          });
        }
      } catch (error) {
        console.error(`Failed to check job ${job.id}:`, error);

        // If too many attempts, mark as failed
        if (job.attempts >= 10) {
          await db
            .update(digestJobs)
            .set({
              status: "failed",
              error: "Max attempts reached",
              updatedAt: new Date(),
            })
            .where(eq(digestJobs.id, job.id));
        }
      }
    }

    return NextResponse.json({
      checked: processingJobs.length,
      updated: updatedJobs,
    });
  } catch (error) {
    console.error("Failed to check digest jobs:", error);
    return NextResponse.json({ error: "Failed to check jobs" }, { status: 500 });
  }
}