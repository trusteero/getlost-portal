import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const coverStoragePath = process.env.COVER_STORAGE_PATH || './uploads/covers';
    const coverDir = path.resolve(coverStoragePath);
    const filePath = path.join(coverDir, filename);

    // Security: Ensure the requested file is within the covers directory
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(coverDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    // Read the file
    const fileBuffer = await fs.readFile(filePath);

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
    return new NextResponse(fileBuffer, {
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