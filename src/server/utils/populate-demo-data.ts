import { db } from "@/server/db";
import {
  marketingAssets,
  bookCovers,
  landingPages,
  books,
  bookVersions,
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  importPrecannedContentForBook,
  findPrecannedCoverImageForFilename,
} from "@/server/utils/precanned-content";
import type { ImportFeatureFlags } from "@/server/utils/precanned-content";

/**
 * Populate demo data for a book when a feature is unlocked
 * This creates placeholder/demo content in the database tables
 */
export async function populateDemoDataForBook(bookId: string, featureType: string) {
  const [book, latestVersion] = await Promise.all([
    db
      .select({ title: books.title })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1),
    db
      .select({ id: bookVersions.id, fileName: bookVersions.fileName })
      .from(bookVersions)
      .where(eq(bookVersions.bookId, bookId))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1),
  ]);

  const bookRecord = book[0];

  if (!bookRecord) {
    throw new Error("Book not found");
  }

  const bookTitle = bookRecord.title;
  const latestVersionRecord = latestVersion[0] || null;
  const latestFileName = latestVersionRecord?.fileName ?? null;

  const featureFlagsMap: Record<string, ImportFeatureFlags> = {
    "manuscript-report": { reports: true, marketing: false, covers: false, landingPage: false },
    "marketing-assets": { reports: false, marketing: true, covers: false, landingPage: false },
    "book-covers": { reports: false, marketing: false, covers: true, landingPage: false },
    "landing-page": { reports: false, marketing: false, covers: false, landingPage: true },
  };

  const desiredFlags = featureFlagsMap[featureType];
  if (desiredFlags && latestFileName) {
    const imported = await importPrecannedContentForBook({
      bookId,
      bookVersionId: latestVersionRecord?.id,
      fileName: latestFileName,
      features: desiredFlags,
    });

    if (imported) {
      // If we imported precanned covers and have a primary cover image, make
      // sure the main book record points at it so the dashboard can show it.
      if (featureType === "book-covers" && imported.primaryCoverImageUrl) {
        await db
          .update(books)
          .set({
            coverImageUrl: imported.primaryCoverImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(books.id, bookId));
      }
      return;
    }

    // If we couldn't import a precanned package for book covers, but we do
    // have a standalone cover image in precannedcontent/uploads that matches
    // this manuscript filename, use that as the primary cover instead of
    // falling back to generic demo covers.
    if (featureType === "book-covers") {
      const uploadsCoverUrl = await findPrecannedCoverImageForFilename(latestFileName);
      if (uploadsCoverUrl) {
        await db.insert(bookCovers).values({
          bookId,
          coverType: "ebook",
          title: `${bookTitle} Cover`,
          imageUrl: uploadsCoverUrl,
          thumbnailUrl: uploadsCoverUrl,
          metadata: JSON.stringify({
            source: "precanned-uploads",
            originalFileName: latestFileName,
          }),
          isPrimary: true,
          status: "completed",
        } as any);

        await db
          .update(books)
          .set({
            coverImageUrl: uploadsCoverUrl,
            updatedAt: new Date(),
          })
          .where(eq(books.id, bookId));

        return;
      }
    }
  }

  switch (featureType) {
    case "marketing-assets":
      await populateMarketingAssets(bookId, bookTitle);
      break;
    case "book-covers":
      await populateBookCovers(bookId, bookTitle);
      break;
    case "landing-page":
      await populateLandingPage(bookId, bookTitle);
      break;
    case "manuscript-report":
      // Report is already populated when book is uploaded or via seed script
      // No additional action needed here
      break;
    default:
      // Unknown feature type, skip
      break;
  }
}

/**
 * Populate marketing assets for a book
 */
async function populateMarketingAssets(bookId: string, bookTitle: string) {
  // Check if assets already exist
  const existing = await db
    .select()
    .from(marketingAssets)
    .where(eq(marketingAssets.bookId, bookId))
    .limit(1);

  if (existing.length > 0) {
    // Assets already exist, skip
    return;
  }

  const assets = [
    {
      bookId,
      assetType: "video",
      title: "Book Trailer",
      description: `60-second promotional video for ${bookTitle}`,
      fileUrl: "/demo-assets/video-trailer.mp4",
      thumbnailUrl: "/demo-assets/video-thumbnail.jpg",
      metadata: JSON.stringify({
        duration: 60,
        format: "mp4",
        resolution: "1920x1080",
      }),
      status: "completed",
    },
    {
      bookId,
      assetType: "social-post",
      title: "Instagram Post",
      description: "Square format social media post",
      fileUrl: "/demo-assets/instagram-post.jpg",
      thumbnailUrl: "/demo-assets/instagram-post.jpg",
      metadata: JSON.stringify({
        platform: "instagram",
        format: "square",
        dimensions: "1080x1080",
      }),
      status: "completed",
    },
    {
      bookId,
      assetType: "banner",
      title: "Website Banner",
      description: "Header banner for website",
      fileUrl: "/demo-assets/website-banner.jpg",
      thumbnailUrl: "/demo-assets/website-banner.jpg",
      metadata: JSON.stringify({
        format: "banner",
        dimensions: "1920x400",
      }),
      status: "completed",
    },
  ];

  for (const asset of assets) {
    await db.insert(marketingAssets).values(asset);
  }
}

/**
 * Populate book covers for a book
 */
async function populateBookCovers(
  bookId: string,
  bookTitle: string
) {
  // Check if covers already exist
  const existing = await db
    .select()
    .from(bookCovers)
    .where(eq(bookCovers.bookId, bookId));

  if (existing.length > 0) {
    // Covers already exist (likely user-generated or placeholders), skip creating defaults
    return;
  }

  const covers = [
    {
      bookId,
      coverType: "ebook",
      title: "eBook Cover",
      imageUrl: "/demo-assets/cover-ebook.jpg",
      thumbnailUrl: "/demo-assets/cover-ebook-thumb.jpg",
      metadata: JSON.stringify({
        format: "ebook",
        dimensions: "1600x2560",
      }),
      isPrimary: true,
      status: "completed",
    },
    {
      bookId,
      coverType: "paperback",
      title: "Paperback Cover",
      imageUrl: "/demo-assets/cover-paperback.jpg",
      thumbnailUrl: "/demo-assets/cover-paperback-thumb.jpg",
      metadata: JSON.stringify({
        format: "paperback",
        dimensions: "1800x2700",
      }),
      isPrimary: false,
      status: "completed",
    },
    {
      bookId,
      coverType: "hardcover",
      title: "Hardcover Design",
      imageUrl: "/demo-assets/cover-hardcover.jpg",
      thumbnailUrl: "/demo-assets/cover-hardcover-thumb.jpg",
      metadata: JSON.stringify({
        format: "hardcover",
        dimensions: "2000x3000",
      }),
      isPrimary: false,
      status: "completed",
    },
  ];

  for (const cover of covers) {
    await db.insert(bookCovers).values(cover);
  }

  // Ensure the dashboard has something to show: if the book doesn't already
  // have a cover image, point it at the primary demo cover we just created.
  const primaryDemoCoverUrl = covers.find((c) => c.isPrimary)?.imageUrl;
  if (primaryDemoCoverUrl) {
    await db
      .update(books)
      .set({
        coverImageUrl: primaryDemoCoverUrl,
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId));
  }
}

/**
 * Populate landing page for a book
 */
async function populateLandingPage(bookId: string, bookTitle: string) {
  // Check if landing page already exists
  const existing = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.bookId, bookId))
    .limit(1);

  if (existing.length > 0) {
    // Landing page already exists, skip
    return;
  }

  // Create slug from title
  const slug = bookTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);

  const headline = `Discover ${bookTitle}`;
  const subheadline = `A captivating story that will keep you turning pages`;
  const description = `Experience the journey of ${bookTitle}. This compelling narrative takes readers on an unforgettable adventure filled with intrigue, emotion, and unforgettable characters.`;

  const htmlContent = `
    <div class="landing-page">
      <section class="hero">
        <h1>${headline}</h1>
        <p class="subheadline">${subheadline}</p>
        <a href="#" class="cta-button">Get Your Copy Today</a>
      </section>
      <section class="about">
        <h2>About the Book</h2>
        <p>${description}</p>
      </section>
      <section class="reviews">
        <h2>What Readers Are Saying</h2>
        <div class="review">
          <p>"An absolutely captivating read!" - Book Reviewer</p>
        </div>
      </section>
    </div>
  `;

  await db.insert(landingPages).values({
    bookId,
    slug,
    title: bookTitle,
    headline,
    subheadline,
    description,
    htmlContent,
    status: "draft",
  });
}

