import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { books, digestJobs } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { checkBookDigestStatus } from "@/server/services/bookdigest";

// GET /api/books/[id]/digest - Get digest job status for a book
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user owns the book
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const bookData = book[0]!;

    if (bookData.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the latest digest job for this book
    const latestJob = await db
      .select()
      .from(digestJobs)
      .where(eq(digestJobs.bookId, id))
      .orderBy(desc(digestJobs.createdAt))
      .limit(1);

    if (latestJob.length === 0) {
      return NextResponse.json({ status: "no_job" });
    }

    const job = latestJob[0]!;

    // If job is processing, check for updates
    if (job.status === "processing" && job.externalJobId) {
      try {
        const updatedStatus = await checkBookDigestStatus(job.id);

        // Get the updated job data after checking status
        const updatedJobResult = await db
          .select()
          .from(digestJobs)
          .where(eq(digestJobs.id, job.id))
          .limit(1);

        const updatedJob = updatedJobResult[0]!;

        return NextResponse.json({
          id: updatedJob.id,
          status: updatedJob.status,
          attempts: updatedJob.attempts,
          startedAt: updatedJob.startedAt,
          completedAt: updatedJob.completedAt,
          error: updatedJob.error,
          title: updatedJob.title,
          author: updatedJob.author,
          pages: updatedJob.pages,
          words: updatedJob.words,
          language: updatedJob.language,
          brief: updatedJob.brief,
          shortSummary: updatedJob.shortSummary,
          summary: updatedJob.summary,
          coverUrl: updatedJob.coverUrl,
        });
      } catch (error) {
        console.error("Failed to check digest status:", error);
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      title: job.title,
      author: job.author,
      pages: job.pages,
      words: job.words,
      language: job.language,
      brief: job.brief,
      shortSummary: job.shortSummary,
      summary: job.summary,
      coverUrl: job.coverUrl,
    });
  } catch (error) {
    console.error("Failed to get digest status:", error);
    return NextResponse.json({ error: "Failed to get digest status" }, { status: 500 });
  }
}

// POST /api/books/[id]/digest/check - Manually trigger status check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user owns the book
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const bookData = book[0]!;

    if (bookData.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the latest digest job for this book
    const latestJob = await db
      .select()
      .from(digestJobs)
      .where(eq(digestJobs.bookId, id))
      .orderBy(desc(digestJobs.createdAt))
      .limit(1);

    if (latestJob.length === 0) {
      return NextResponse.json({ error: "No digest job found" }, { status: 404 });
    }

    const job = latestJob[0]!;

    if (!job.externalJobId) {
      return NextResponse.json({ error: "No external job ID" }, { status: 400 });
    }

    // Check status from external service
    const updatedStatus = await checkBookDigestStatus(job.id);

    return NextResponse.json({
      id: job.id,
      status: updatedStatus.status,
      message: updatedStatus.status === "completed" ? "Digest processing complete" : "Status updated",
    });
  } catch (error) {
    console.error("Failed to check digest status:", error);
    return NextResponse.json({ error: "Failed to check digest status" }, { status: 500 });
  }
}