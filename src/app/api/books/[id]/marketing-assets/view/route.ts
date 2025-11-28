import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, marketingAssets, bookFeatures } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/marketing-assets/view
 * Returns the marketing assets HTML content directly (not as JSON)
 * This avoids JSON response size limits and iframe srcDoc restrictions
 * 
 * Requires: marketing-assets feature to be unlocked
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    const { id: bookId } = await params;

    console.log('[Marketing Assets View] Request received for bookId:', bookId);

    if (!session?.user?.id) {
      console.log('[Marketing Assets View] Unauthorized - no session');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('[Marketing Assets View] Session valid, userId:', session.user.id);
    // Verify the user owns this book
    const [book] = await db
      .select({
        id: books.id,
        userId: books.userId,
      })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book || book.userId !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check if marketing-assets feature is unlocked
    const [feature] = await db
      .select()
      .from(bookFeatures)
      .where(
        and(
          eq(bookFeatures.bookId, bookId),
          eq(bookFeatures.featureType, "marketing-assets")
        )
      )
      .limit(1);

    if (!feature || feature.status === "locked") {
      return NextResponse.json(
        { error: "Feature not unlocked. Please purchase the marketing assets first." },
        { status: 403 }
      );
    }

    // Get marketing assets - prefer active one, otherwise get HTML one, otherwise any
    const allAssets = await db
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.bookId, bookId));

    // Find active asset using database column (not metadata)
    let activeAsset = allAssets.find(asset => asset.isActive === true);

    // If no active asset, find HTML asset
    if (!activeAsset) {
      activeAsset = allAssets.find(asset => {
        if (!asset.metadata) return false;
        try {
          const metadata = JSON.parse(asset.metadata);
          return metadata.variant === "html";
        } catch {
          return false;
        }
      });
    }

    // If still no active asset, use first asset
    if (!activeAsset && allAssets.length > 0) {
      activeAsset = allAssets[0];
    }

    if (!activeAsset || !activeAsset.metadata) {
      console.error('[Marketing Assets View] No active asset found or missing metadata');
      return NextResponse.json(
        { error: "Marketing assets not found" },
        { status: 404 }
      );
    }

    if (!activeAsset.id) {
      console.error('[Marketing Assets View] Active asset missing id:', activeAsset);
      return NextResponse.json(
        { error: "Invalid marketing asset data" },
        { status: 500 }
      );
    }

    // Parse metadata to get HTML content
    let htmlContent: string | null = null;
    try {
      const metadata = JSON.parse(activeAsset.metadata);
      htmlContent = metadata.htmlContent || null;
    } catch (parseError) {
      console.error('[Marketing Assets View] Failed to parse metadata:', parseError);
      return NextResponse.json(
        { error: "Invalid marketing asset metadata" },
        { status: 500 }
      );
    }

    if (!htmlContent) {
      console.error('[Marketing Assets View] No HTML content in metadata');
      return NextResponse.json(
        { error: "Marketing assets HTML content not found" },
        { status: 404 }
      );
    }

    // Update viewedAt timestamp when user views the marketing asset
    try {
      await db
        .update(marketingAssets)
        .set({ viewedAt: new Date() })
        .where(eq(marketingAssets.id, activeAsset.id));
    } catch (updateError) {
      console.error('[Marketing Assets View] Failed to update viewedAt:', updateError);
      // Don't fail the request if viewedAt update fails
    }

    // Inject base tag - critical for videos in iframes
    // Absolute paths like /api/uploads/... need a base URL to resolve correctly
    let finalHtml = htmlContent;
    const origin = request.headers.get('origin') || request.nextUrl.origin;
    
    // Remove any existing base tags first
    finalHtml = finalHtml.replace(/<base[^>]*>/gi, '');
    
    // Inject base tag right after <head> tag
    finalHtml = finalHtml.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${origin}">`
    );
    
    // Enhance video tags for iframe playback
    // Add necessary attributes for reliable video playback in iframes
    finalHtml = finalHtml.replace(
      /<video([^>]*)>/gi,
      (match, attrs) => {
        let enhanced = match;
        
        // Add playsinline if not present (required for iOS)
        if (!enhanced.includes('playsinline')) {
          enhanced = enhanced.replace('>', ' playsinline>');
        }
        
        // Add webkit-playsinline for older iOS
        if (!enhanced.includes('webkit-playsinline')) {
          enhanced = enhanced.replace('>', ' webkit-playsinline>');
        }
        
        // Ensure controls attribute is present (videos need user interaction to play)
        if (!enhanced.includes('controls')) {
          enhanced = enhanced.replace('>', ' controls>');
        }
        
        return enhanced;
      }
    );
    
    // Debug: Check if videos are in the HTML
    const videoMatches = finalHtml.match(/src=["']([^"']*video[^"']*)["']/gi);
    const videoTags = finalHtml.match(/<video[^>]*>/gi);
    console.log('[Marketing Assets View] Origin:', origin);
    console.log('[Marketing Assets View] Base tag injected:', finalHtml.includes('<base'));
    if (videoMatches) {
      console.log('[Marketing Assets View] Found video sources:', videoMatches.slice(0, 3));
    } else {
      console.warn('[Marketing Assets View] No video sources found in HTML');
    }
    if (videoTags) {
      console.log('[Marketing Assets View] Video tags after enhancement:', videoTags.slice(0, 2));
    }

    // Add a small script to help with video loading in iframes
    // This ensures videos can load and play when user clicks
    if (!finalHtml.includes('</body>')) {
      // If no body tag, append to end
      finalHtml += '<script>document.addEventListener("DOMContentLoaded", function() { const videos = document.querySelectorAll("video"); videos.forEach(v => { v.addEventListener("error", function(e) { console.error("Video error:", e, this.src); }); v.addEventListener("loadstart", function() { console.log("Video loading:", this.src); }); v.addEventListener("canplay", function() { console.log("Video can play:", this.src); }); }); });</script></body></html>';
    } else {
      // Inject script before closing body tag
      finalHtml = finalHtml.replace(
        '</body>',
        '<script>document.addEventListener("DOMContentLoaded", function() { const videos = document.querySelectorAll("video"); videos.forEach(v => { v.addEventListener("error", function(e) { console.error("Video error:", e, this.src); }); v.addEventListener("loadstart", function() { console.log("Video loading:", this.src); }); v.addEventListener("canplay", function() { console.log("Video can play:", this.src); }); }); });</script></body>'
      );
    }

    // Return HTML directly with proper headers
    return new NextResponse(finalHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Frame-Options': 'SAMEORIGIN', // Allow iframe embedding from same origin
      },
    });
  } catch (error) {
    console.error("Failed to fetch marketing assets HTML:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return NextResponse.json(
      { error: "Failed to fetch marketing assets HTML", details: errorMessage },
      { status: 500 }
    );
  }
}

