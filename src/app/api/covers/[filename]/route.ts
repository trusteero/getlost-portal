import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Check if filename looks like a UUID (uploaded file) vs precanned content
  // UUID format: 8-4-4-4-12 hex characters (e.g., "8625796c-bffb-45aa-ba6e-2e77a1ff6d8a")
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/i;
  const isLikelyUploadedFile = uuidPattern.test(filename);
  
  // For uploaded files (UUIDs), only check the standard covers directory
  // For precanned files (like "wool.jpg", "beach_read.jpg"), check all locations
  const shouldCheckPrecanned = !isLikelyUploadedFile;

  try {
    // First, try the standard covers directory
    // Use process.cwd() to ensure we resolve from project root
    const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
    const coverDir = path.resolve(coverStoragePath);
    let filePath = path.join(coverDir, filename);
    let resolvedPath = path.resolve(filePath);
    
    // Security: Ensure the requested file is within the covers directory
    if (!resolvedPath.startsWith(coverDir)) {
      console.error(`[Covers API] Security check failed: ${resolvedPath} does not start with ${coverDir}`);
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }
    
    // Check if directory exists and is accessible
    let dirExists = false;
    let dirWritable = false;
    try {
      await fs.access(coverDir);
      dirExists = true;
      // Try to write a test file to check if directory is writable
      try {
        const testFile = path.join(coverDir, '.test-write');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        dirWritable = true;
      } catch {
        dirWritable = false;
      }
    } catch {
      dirExists = false;
    }
    
    // Try to read from standard covers directory
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
      // Success - return the file
    } catch (error: any) {
      // File not found in standard location
      
      // Log diagnostic information
      console.log(`[Covers API] File not found in standard location: ${filePath}`);
      console.log(`[Covers API] Directory exists: ${dirExists}, Writable: ${dirWritable}`);
      console.log(`[Covers API] Cover storage path: ${coverStoragePath}`);
      console.log(`[Covers API] Resolved cover dir: ${coverDir}`);
      console.log(`[Covers API] Error: ${error.message}`);
      
      // If this looks like an uploaded file (UUID), don't check precanned locations
      if (!shouldCheckPrecanned) {
        // For uploaded files, check if directory exists and list files for debugging
        if (dirExists) {
          try {
            const files = await fs.readdir(coverDir);
            console.log(`[Covers API] Files in covers directory (${files.length} total): ${files.slice(0, 10).join(', ')}${files.length > 10 ? '...' : ''}`);
          } catch (listError: any) {
            console.log(`[Covers API] Could not list directory contents: ${listError.message}`);
          }
        }
        console.log(`[Covers API] Uploaded cover image not found: ${filename}`);
        return NextResponse.json({ error: "Cover image not found" }, { status: 404 });
      }
      
      // For precanned files, try fallback locations
      console.log(`[Covers API] File not found in standard location, checking precanned locations for: ${filename}`);
      
      // Try precanned uploads directory (for precanned cover images)
      const precannedUploadsPath = path.resolve(process.cwd(), 'public', 'uploads', 'precanned', 'uploads', filename);
      const precannedResolvedPath = path.resolve(precannedUploadsPath);
      const precannedBaseDir = path.resolve(process.cwd(), 'public', 'uploads', 'precanned', 'uploads');
      
      // Security: Ensure the requested file is within the precanned uploads directory
      if (!precannedResolvedPath.startsWith(precannedBaseDir)) {
        console.error(`[Covers API] Security check failed for precanned: ${precannedResolvedPath} does not start with ${precannedBaseDir}`);
        return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
      }
      
      try {
        fileBuffer = await fs.readFile(precannedUploadsPath);
        console.log(`[Covers API] ✅ Found in precanned public location: ${precannedUploadsPath}`);
      } catch (precannedError: any) {
        // If not in public/uploads/precanned/uploads, try source precannedcontent/uploads
        const sourcePrecannedPath = path.resolve(process.cwd(), 'precannedcontent', 'uploads', filename);
        const sourcePrecannedResolved = path.resolve(sourcePrecannedPath);
        const sourcePrecannedBaseDir = path.resolve(process.cwd(), 'precannedcontent', 'uploads');
        
        // Security: Ensure the requested file is within the source precanned uploads directory
        if (!sourcePrecannedResolved.startsWith(sourcePrecannedBaseDir)) {
          console.error(`[Covers API] Security check failed for source precanned: ${sourcePrecannedResolved} does not start with ${sourcePrecannedBaseDir}`);
          return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
        }
        
        try {
          fileBuffer = await fs.readFile(sourcePrecannedPath);
          console.log(`[Covers API] ✅ Found in source precanned location: ${sourcePrecannedPath}`);
        } catch (sourceError: any) {
          // File not found in any location
          console.log(`[Covers API] Cover image not found in any location: ${filename}`);
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