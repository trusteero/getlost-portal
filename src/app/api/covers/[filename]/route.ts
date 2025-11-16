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
    const coverStoragePath = process.env.COVER_STORAGE_PATH || './uploads/covers';
    const coverDir = path.resolve(coverStoragePath);
    let filePath = path.join(coverDir, filename);
    let resolvedPath = path.resolve(filePath);
    
    // If not found in covers directory, try precanned uploads
    let fileBuffer: Buffer;
    try {
      // Security: Ensure the requested file is within the covers directory
      if (!resolvedPath.startsWith(coverDir)) {
        throw new Error("Invalid path");
      }
      fileBuffer = await fs.readFile(filePath);
    } catch {
      // Try precanned uploads directory
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