import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * API route to serve admin-uploaded assets (videos, images, etc.)
 * This handles paths like /api/uploads/admin/{bookId}/{assetType}/videos/{filename}
 * Similar to the precanned route but for admin uploads
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  
  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "File path required" }, { status: 400 });
  }
  
  const filename = pathSegments[pathSegments.length - 1];
  
  if (!filename) {
    return NextResponse.json({ error: "Filename required" }, { status: 400 });
  }
  
  try {
    // Build path to file in public/uploads/admin/
    const publicPath = path.resolve(process.cwd(), "public", "uploads", "admin", ...pathSegments);
    const publicBaseDir = path.resolve(process.cwd(), "public", "uploads", "admin");
    
    // Security check
    if (!publicPath.startsWith(publicBaseDir)) {
      console.error(`[Admin Uploads API] Security check failed for path`);
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }
    
    // Check if file exists
    try {
      await fs.access(publicPath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    // Read file
    const fileBuffer = await fs.readFile(publicPath);
    
    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = "application/octet-stream";
    
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        mimeType = "image/jpeg";
        break;
      case ".png":
        mimeType = "image/png";
        break;
      case ".gif":
        mimeType = "image/gif";
        break;
      case ".webp":
        mimeType = "image/webp";
        break;
      case ".mp4":
        mimeType = "video/mp4";
        break;
      case ".mov":
        mimeType = "video/quicktime";
        break;
      case ".webm":
        mimeType = "video/webm";
        break;
      case ".svg":
        mimeType = "image/svg+xml";
        break;
    }
    
    // Handle Range requests for video playback (required for MP4 seeking)
    const range = request.headers.get("range");
    if (range && (ext === ".mp4" || ext === ".webm" || ext === ".mov")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0] || "0", 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileBuffer.length - 1;
      const chunksize = end - start + 1;
      const chunk = fileBuffer.slice(start, end + 1);
      
      return new NextResponse(chunk, {
        status: 206, // Partial Content
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileBuffer.length}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
        },
      });
    }
    
    // Return the file with CORS headers to allow iframe access
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length.toString(),
        "Accept-Ranges": "bytes", // Indicate support for Range requests
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*", // Allow iframe access
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
      },
    });
  } catch (error: any) {
    console.error("[Admin Uploads API] Failed to serve file:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}

