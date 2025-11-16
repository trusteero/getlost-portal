import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  console.log(`[Covers API] Request for cover: ${filename}`);
  console.log(`[Covers API] process.cwd(): ${process.cwd()}`);

  try {
    // First, try the standard covers directory
    // Use process.cwd() to ensure we resolve from project root
    const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
    const coverDir = path.resolve(coverStoragePath);
    let filePath = path.join(coverDir, filename);
    let resolvedPath = path.resolve(filePath);
    
    console.log(`[Covers API] coverDir: ${coverDir}`);
    console.log(`[Covers API] filePath: ${filePath}`);
    console.log(`[Covers API] resolvedPath: ${resolvedPath}`);
    
    // Security: Ensure the requested file is within the covers directory
    if (!resolvedPath.startsWith(coverDir)) {
      console.error(`[Covers API] Security check failed: ${resolvedPath} does not start with ${coverDir}`);
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }
    
    // Check if directory exists
    try {
      await fs.access(coverDir);
      console.log(`[Covers API] Directory exists: ${coverDir}`);
    } catch {
      console.error(`[Covers API] Directory does not exist: ${coverDir}`);
    }
    
    // If not found in covers directory, try precanned uploads
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
      console.log(`[Covers API] Successfully read file from: ${filePath}`);
    } catch (error: any) {
      // Log the error for debugging
      console.log(`[Covers API] File not found in ${filePath}, error: ${error.message}`);
      console.log(`[Covers API] Trying precanned uploads...`);
      
      // Try precanned uploads directory (for precanned cover images)
      const precannedUploadsPath = path.resolve(process.cwd(), 'public', 'uploads', 'precanned', 'uploads', filename);
      const precannedResolvedPath = path.resolve(precannedUploadsPath);
      const precannedBaseDir = path.resolve(process.cwd(), 'public', 'uploads', 'precanned', 'uploads');
      
      console.log(`[Covers API] precannedUploadsPath: ${precannedUploadsPath}`);
      console.log(`[Covers API] precannedBaseDir: ${precannedBaseDir}`);
      
      // Security: Ensure the requested file is within the precanned uploads directory
      if (!precannedResolvedPath.startsWith(precannedBaseDir)) {
        console.error(`[Covers API] Security check failed for precanned: ${precannedResolvedPath} does not start with ${precannedBaseDir}`);
        return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
      }
      
      try {
        fileBuffer = await fs.readFile(precannedUploadsPath);
        console.log(`[Covers API] Successfully read file from precanned: ${precannedUploadsPath}`);
      } catch (precannedError: any) {
        // If not in public/uploads/precanned/uploads, try source precannedcontent/uploads
        console.log(`[Covers API] File not in public/uploads/precanned/uploads, trying source directory...`);
        const sourcePrecannedPath = path.resolve(process.cwd(), 'precannedcontent', 'uploads', filename);
        const sourcePrecannedResolved = path.resolve(sourcePrecannedPath);
        const sourcePrecannedBaseDir = path.resolve(process.cwd(), 'precannedcontent', 'uploads');
        
        console.log(`[Covers API] sourcePrecannedPath: ${sourcePrecannedPath}`);
        console.log(`[Covers API] sourcePrecannedBaseDir: ${sourcePrecannedBaseDir}`);
        
        // Security: Ensure the requested file is within the source precanned uploads directory
        if (!sourcePrecannedResolved.startsWith(sourcePrecannedBaseDir)) {
          console.error(`[Covers API] Security check failed for source precanned: ${sourcePrecannedResolved} does not start with ${sourcePrecannedBaseDir}`);
          return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
        }
        
        try {
          fileBuffer = await fs.readFile(sourcePrecannedPath);
          console.log(`[Covers API] ✅ Successfully read file from source precanned: ${sourcePrecannedPath}`);
        } catch (sourceError: any) {
          console.error(`[Covers API] Cover image not found in any location. Filename: ${filename}`);
          console.error(`[Covers API] Source precanned error: ${sourceError.message}`);
          return NextResponse.json({ error: "Cover image not found" }, { status: 404 });
        }
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