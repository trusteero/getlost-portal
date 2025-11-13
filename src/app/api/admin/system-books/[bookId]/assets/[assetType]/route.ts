import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, marketingAssets, bookCovers, landingPages } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/system-books/[bookId]/assets/[assetType]
 * Upload/manage assets for a system book
 * assetType: marketing-assets | covers | landing-page
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; assetType: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { bookId, assetType } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Verify it's a system book
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book || book.title !== "SYSTEM_SEEDED_REPORTS") {
      return NextResponse.json({ error: "Not a system book" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const metadata = formData.get("metadata") as string | null;

    if (assetType === "marketing-assets") {
      if (!file || !title) {
        return NextResponse.json({ error: "File and title required" }, { status: 400 });
      }

      // Save file
      const assetStoragePath = process.env.ASSET_STORAGE_PATH || './uploads/assets';
      const assetDir = path.resolve(assetStoragePath);
      await fs.mkdir(assetDir, { recursive: true });

      const fileExt = path.extname(file.name);
      const assetId = randomUUID();
      const assetFileName = `${assetId}${fileExt}`;
      const assetFilePath = path.join(assetDir, assetFileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(assetFilePath, buffer);

      const fileUrl = `/api/assets/${assetId}${fileExt}`;
      const thumbnailUrl = fileUrl; // TODO: Generate thumbnail

      // Determine asset type from file
      const assetTypeValue = file.type.startsWith('video/') ? 'video' :
                            file.type.startsWith('image/') ? 'image' : 'other';

      await db.insert(marketingAssets).values({
        id: assetId,
        bookId,
        assetType: assetTypeValue,
        title: title,
        description: description || "",
        fileUrl,
        thumbnailUrl,
        metadata: metadata || "{}",
        status: "completed",
      });

      return NextResponse.json({ success: true, assetId });
    } else if (assetType === "covers") {
      if (!file || !title) {
        return NextResponse.json({ error: "File and title required" }, { status: 400 });
      }

      // Save cover
      const coverStoragePath = process.env.COVER_STORAGE_PATH || './uploads/covers';
      const coverDir = path.resolve(coverStoragePath);
      await fs.mkdir(coverDir, { recursive: true });

      const fileExt = path.extname(file.name);
      const coverId = randomUUID();
      const coverFileName = `${coverId}${fileExt}`;
      const coverFilePath = path.join(coverDir, coverFileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(coverFilePath, buffer);

      const imageUrl = `/api/covers/${coverId}${fileExt}`;
      const thumbnailUrl = imageUrl; // TODO: Generate thumbnail

      const coverType = formData.get("coverType") as string || "ebook";

      await db.insert(bookCovers).values({
        id: coverId,
        bookId,
        coverType,
        title: title,
        imageUrl,
        thumbnailUrl,
        metadata: metadata || "{}",
        isPrimary: false,
        status: "completed",
      });

      return NextResponse.json({ success: true, coverId });
    } else if (assetType === "landing-page") {
      const htmlContent = formData.get("htmlContent") as string | null;
      const headline = formData.get("headline") as string | null;
      const subheadline = formData.get("subheadline") as string | null;
      const pageDescription = formData.get("description") as string | null;

      if (!htmlContent || !headline) {
        return NextResponse.json({ error: "HTML content and headline required" }, { status: 400 });
      }

      // Check if landing page exists
      const existing = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.bookId, bookId))
        .limit(1);

      const slug = book.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

      if (existing.length > 0) {
        // Update existing
        await db
          .update(landingPages)
          .set({
            htmlContent,
            headline,
            subheadline: subheadline || "",
            description: pageDescription || "",
            updatedAt: new Date(),
          })
          .where(eq(landingPages.id, existing[0]!.id));

        return NextResponse.json({ success: true, landingPageId: existing[0]!.id });
      } else {
        // Create new
        const landingPageId = randomUUID();
        await db.insert(landingPages).values({
          id: landingPageId,
          bookId,
          slug,
          title: book.title,
          headline,
          subheadline: subheadline || "",
          description: pageDescription || "",
          htmlContent,
          status: "draft",
        });

        return NextResponse.json({ success: true, landingPageId });
      }
    } else {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to upload asset:", error);
    return NextResponse.json(
      { error: "Failed to upload asset" },
      { status: 500 }
    );
  }
}
