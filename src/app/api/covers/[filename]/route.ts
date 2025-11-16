import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    // First, try the standard covers directory
    // Use process.cwd() to ensure we resolve from project root
    const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
    const coverDir = path.resolve(coverStoragePath);
    let filePath = path.join(coverDir, filename);
    let resolvedPath = path.resolve(filePath);
    
    // Security: Ensure the requested file is within the covers directory
    if (!resolvedPath.startsWith(coverDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }
    
    // If not found in covers directory, try precanned uploads
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (error) {
      // Log the error for debugging
      console.log(`[Covers API] File not found in ${filePath}, trying precanned uploads`);
      
      // Try precanned uploads directory (for precanned cover images)
      const precannedUploadsPath = path.resolve(process.cwd(), 'public', 'uploads', 'precanned', 'uploads', filename);
      const precannedResolvedPath = path.resolve(precannedUploadsPath);
      const precannedBaseDir = path.resolve(process.cwd(), 'public', 'uploads', 'precanned', 'uploads');
      
      // Security: Ensure the requested file is within the precanned uploads directory
      if (!precannedResolvedPath.startsWith(precannedBaseDir)) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
      }
      
      try {
        fileBuffer = await fs.readFile(precannedUploadsPath);
      } catch {
        console.error(`[Covers API] Cover image not found: ${filename}`);
        return NextResponse.json({ error: "Cover image not found" }, { status: 404 });
      }
    }

    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'application/octet-stream';

    switch(ext) {
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg';
        break;
      case '.png':
        mimeType = 'image/png';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
    }

    // Return the image
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Failed to serve cover image:", error);
    return NextResponse.json({ error: "Cover image not found" }, { status: 404 });
  }
}