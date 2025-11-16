import { db } from "@/server/db";
import { digestJobs, books } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

const BOOKDIGEST_URL = process.env.BOOKDIGEST_URL || "https://bookdigest.onrender.com";
const BOOKDIGEST_API_KEY = process.env.BOOKDIGEST_API_KEY || "";

interface BookDigestJobResponse {
  job_id: string;
}

interface BookDigestStatusResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  format?: string;
  error?: string;
  result?: {
    text_url?: string;
    cover_url?: string;
    meta?: {
      title?: string;
      author?: string;
      pages?: number;
      words?: number;
      language?: string;
      format?: string;
    };
    brief?: string;
    short_summary?: string;
    summary?: string;
    ai_processed?: boolean;
    token_count?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

export async function triggerBookDigest(bookId: string, fileBuffer: Buffer, fileName: string) {
  try {
    // Check if API key is configured
    if (!BOOKDIGEST_API_KEY) {
      console.log(`BookDigest API key not configured, skipping digest for book ${bookId}`);
      return null;
    }

    // Check if a job already exists for this book
    const existingJob = await db
      .select()
      .from(digestJobs)
      .where(and(
        eq(digestJobs.bookId, bookId),
        eq(digestJobs.status, "processing")
      ))
      .limit(1);

    if (existingJob.length > 0) {
      console.log(`Digest job already in progress for book ${bookId}`);
      return existingJob[0];
    }

    // Create a new digest job record
    const [newJob] = await db
      .insert(digestJobs)
      .values({
        bookId,
        status: "pending",
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create FormData for file upload
    const formData = new FormData();
    const file = new Blob([fileBuffer as any], { type: 'application/octet-stream' });
    formData.append("file", file, fileName);

    // Send request to BookDigest service
    const response = await fetch(`${BOOKDIGEST_URL}/v1/ingest`, {
      method: "POST",
      headers: {
        "X-API-Key": BOOKDIGEST_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      // Don't throw error - just log it and mark job as failed
      // BookDigest is optional, book creation should still succeed
      console.error(`BookDigest API error: ${error}`);
      
      // Update job status to failed
      await db
        .update(digestJobs)
        .set({
          status: "failed",
          error: error,
          updatedAt: new Date(),
        })
        .where(eq(digestJobs.id, newJob!.id));
      
      return null;
    }

    const data: BookDigestJobResponse = await response.json();

    // Update job with external ID
    await db
      .update(digestJobs)
      .set({
        externalJobId: data.job_id,
        status: "processing",
        startedAt: new Date(),
        attempts: 1,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(digestJobs.id, newJob!.id));

    console.log(`BookDigest job ${data.job_id} started for book ${bookId}`);

    return {
      ...newJob!,
      externalJobId: data.job_id,
      status: "processing",
    };
  } catch (error) {
    console.error("Failed to trigger BookDigest:", error);

    // Update job status to failed if it exists
    try {
      await db
        .update(digestJobs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(and(
          eq(digestJobs.bookId, bookId),
          eq(digestJobs.status, "pending")
        ));
    } catch (updateError) {
      console.error("Failed to update digest job status:", updateError);
    }

    // Don't throw - return null so book creation can continue
    return null;
  }
}

export async function checkBookDigestStatus(jobId: string) {
  // Get the digest job from database first (outside try block)
  const [job] = await db
    .select()
    .from(digestJobs)
    .where(eq(digestJobs.id, jobId))
    .limit(1);

  if (!job || !job.externalJobId) {
    throw new Error("Digest job not found or no external ID");
  }

  try {

    // Check status from BookDigest service
    const response = await fetch(`${BOOKDIGEST_URL}/v1/jobs/${job.externalJobId}`, {
      headers: {
        "X-API-Key": BOOKDIGEST_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`BookDigest API error: ${error}`);
    }

    const data: BookDigestStatusResponse = await response.json();

    // Update job based on status
    if (data.status === "completed" && data.result) {
      const result = data.result;

      // Download and store cover image locally if present
      let coverImageUrl: string | null = null;
      if (result.cover_url) {
        try {
          // Build the URL to fetch from BookDigest
          const sourceUrl = result.cover_url.startsWith("/")
            ? `${BOOKDIGEST_URL}${result.cover_url}`
            : result.cover_url;

          // Fetch the image
          const imageResponse = await fetch(sourceUrl, {
            headers: {
              "X-API-Key": BOOKDIGEST_API_KEY,
            },
          });

          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);

            // Get the book ID from the digest job
            const [job] = await db.select({ bookId: digestJobs.bookId })
              .from(digestJobs)
              .where(eq(digestJobs.id, jobId))
              .limit(1);

            if (job) {
              // Save cover to file system
              const coverStoragePath = process.env.COVER_STORAGE_PATH || './uploads/covers';
              const coverDir = path.resolve(coverStoragePath);

              // Create directory if it doesn't exist
              await fs.mkdir(coverDir, { recursive: true });

              // Determine file extension from content type
              const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
              const ext = contentType.split('/')[1] || 'jpg';
              const coverFileName = `${job.bookId}.${ext}`;
              const coverFilePath = path.join(coverDir, coverFileName);

              // Save cover image to disk
              await fs.writeFile(coverFilePath, buffer);

              // Store the API path for serving
              coverImageUrl = `/api/covers/${job.bookId}.${ext}`;
            }
          }
        } catch (error) {
          console.error("Failed to download cover image:", error);
          // Continue without cover if download fails
        }
      }

      // Update digest job with results
      await db
        .update(digestJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          textUrl: result.text_url,
          coverUrl: result.cover_url,
          title: result.meta?.title,
          author: result.meta?.author,
          pages: result.meta?.pages,
          words: result.meta?.words,
          language: result.meta?.language,
          brief: result.brief,
          shortSummary: result.short_summary,
          summary: result.summary,
          updatedAt: new Date(),
        })
        .where(eq(digestJobs.id, jobId));

      // Update book with cover if extracted
      if (coverImageUrl && job.bookId) {
        const [existingBook] = await db
          .select({ coverImageUrl: books.coverImageUrl })
          .from(books)
          .where(eq(books.id, job.bookId))
          .limit(1);

        if (!existingBook?.coverImageUrl) {
          console.log(`Updating book ${job.bookId} with cover URL: ${coverImageUrl}`);
          await db
            .update(books)
            .set({
              coverImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(books.id, job.bookId));
          console.log(`Successfully updated book ${job.bookId} with cover`);
        } else {
          console.log(`Book ${job.bookId} already has a cover, skipping BookDigest cover update`);
        }
      } else {
        console.log(`No cover URL to update for book ${job.bookId}`);
      }

      // Update book with brief as description if extracted and empty
      if (result.brief && job.bookId) {
        const [book] = await db
          .select()
          .from(books)
          .where(eq(books.id, job.bookId))
          .limit(1);

        // Update the book's description if empty
        if (book && !book.description) {
          await db
            .update(books)
            .set({
              description: result.brief,
              updatedAt: new Date(),
            })
            .where(eq(books.id, job.bookId));
        }
      }

      return { ...job, status: "completed", result };
    } else if (data.status === "failed") {
      await db
        .update(digestJobs)
        .set({
          status: "failed",
          error: data.error || "Processing failed",
          updatedAt: new Date(),
        })
        .where(eq(digestJobs.id, jobId));

      return { ...job, status: "failed", error: data.error };
    } else {
      // Still processing
      return { ...job, status: data.status };
    }
  } catch (error) {
    console.error("Failed to check BookDigest status:", error);

    // Increment attempts
    await db
      .update(digestJobs)
      .set({
        attempts: job.attempts + 1,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(digestJobs.id, jobId));

    throw error;
  }
}

// Retry failed or stuck jobs
export async function retryFailedDigestJobs() {
  try {
    // Find jobs that are stuck or failed but haven't exceeded max attempts
    const stuckJobs = await db
      .select()
      .from(digestJobs)
      .where(and(
        eq(digestJobs.status, "processing"),
        // Consider jobs stuck if they've been processing for over 10 minutes
        // This would need a more complex query in production
      ))
      .limit(10);

    for (const job of stuckJobs) {
      if (job.externalJobId && job.attempts < 5) {
        try {
          await checkBookDigestStatus(job.id);
        } catch (error) {
          console.error(`Failed to check status for job ${job.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Failed to retry digest jobs:", error);
  }
}