import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * API route to serve precanned assets (images, videos, etc.)
 * This handles paths like /uploads/precanned/uploads/beach_read.jpg
 * 
 * On Render, files copied at runtime to public/ might not be served,
 * so we read directly from the source precannedcontent/ directory.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filename = pathSegments[pathSegments.length - 1];
  
  if (!filename) {
    console.error(`[Precanned API] No filename in path segments: ${JSON.stringify(pathSegments)}`);
    return NextResponse.json({ error: "Filename required" }, { status: 400 });
  }

  console.log(`[Precanned API] Request for: ${pathSegments.join("/")}`);
  console.log(`[Precanned API] Path segments: ${JSON.stringify(pathSegments)}`);
  console.log(`[Precanned API] Filename: ${filename}`);
  console.log(`[Precanned API] process.cwd(): ${process.cwd()}`);
  console.log(`[Precanned API] __dirname equivalent: ${import.meta.url}`);
  
  // On Render, the project root might be different - try to detect it
  const projectRoot = process.cwd();
  console.log(`[Precanned API] Project root (process.cwd()): ${projectRoot}`);
  
  // Check if we're in a src/ subdirectory structure
  try {
    const srcCheck = path.resolve(projectRoot, "src");
    const srcExists = await fs.access(srcCheck).then(() => true).catch(() => false);
    console.log(`[Precanned API] src/ directory exists: ${srcExists} at ${srcCheck}`);
  } catch {
    // Ignore
  }

  try {
    // First, try the copied location in public/uploads/precanned/
    const publicPath = path.resolve(process.cwd(), "public", "uploads", "precanned", ...pathSegments);
    const publicBaseDir = path.resolve(process.cwd(), "public", "uploads", "precanned");
    
    // Security check
    if (!publicPath.startsWith(publicBaseDir)) {
      console.error(`[Precanned API] Security check failed for public path`);
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    let fileBuffer: Buffer | null = null;
    try {
      fileBuffer = await fs.readFile(publicPath);
      console.log(`[Precanned API] ✅ Served from public: ${publicPath}`);
    } catch (publicError: any) {
      // If not in public, try source precannedcontent/ directory
      console.log(`[Precanned API] File not in public, trying source precannedcontent...`);
      
      // Reconstruct path in precannedcontent/
      // e.g., /uploads/precanned/uploads/beach_read.jpg -> precannedcontent/uploads/beach_read.jpg
      // e.g., /uploads/precanned/wool/covers/cover1.png -> precannedcontent/Wool/Covers/cover1.png
      
      // Try multiple possible locations (accounting for different project structures)
      const possiblePaths: string[] = [];
      
      // Build all possible paths to try
      const basePaths = [
        process.cwd(), // Standard: project root
        path.resolve(process.cwd(), "src"), // If in src/ subdirectory
        path.resolve(process.cwd(), ".."), // Parent directory
        path.resolve(process.cwd(), "../src"), // Parent/src
      ];
      
      if (pathSegments[0] === "uploads" && pathSegments.length === 2) {
        // Special case: /api/uploads/precanned/uploads/filename -> precannedcontent/uploads/filename
        for (const base of basePaths) {
          possiblePaths.push(
            path.resolve(base, "precannedcontent", "uploads", filename)
          );
        }
        console.log(`[Precanned API] Using uploads special case mapping`);
      } else {
        // General case: map path segments to precannedcontent structure
        for (const base of basePaths) {
          possiblePaths.push(
            path.resolve(base, "precannedcontent", ...pathSegments)
          );
        }
        console.log(`[Precanned API] Using general case mapping`);
      }
      
      // Build base directories to check
      const sourceBaseDirs: string[] = [];
      for (const base of basePaths) {
        sourceBaseDirs.push(
          path.resolve(base, "precannedcontent"),
          path.resolve(base, "src", "precannedcontent")
        );
      }
      
      console.log(`[Precanned API] Trying ${possiblePaths.length} possible paths:`);
      possiblePaths.forEach((p, i) => {
        console.log(`[Precanned API]   ${i + 1}. ${p}`);
      });
      
      // Check which base directory exists
      let validBaseDir: string | null = null;
      for (const baseDir of sourceBaseDirs) {
        try {
          await fs.access(baseDir);
          validBaseDir = baseDir;
          console.log(`[Precanned API] ✅ Found valid base directory: ${baseDir}`);
          break;
        } catch {
          // Continue to next
        }
      }
      
      if (!validBaseDir) {
        console.error(`[Precanned API] ❌ No valid precannedcontent base directory found`);
        console.error(`[Precanned API] Tried: ${sourceBaseDirs.join(", ")}`);
      }
      
      // Try each possible path
      let fileFound = false;
      for (const sourcePath of possiblePaths) {
        // Security check - ensure path is within a valid base directory
        // If we have a valid base dir, only try paths within it
        // Otherwise, try all paths (might be during build or unusual setup)
        if (validBaseDir) {
          const isSecure = sourcePath.startsWith(validBaseDir);
          if (!isSecure) {
            console.log(`[Precanned API] Skipping path outside valid base: ${sourcePath}`);
            continue;
          }
        }
        
        try {
          await fs.access(sourcePath);
          const stats = await fs.stat(sourcePath);
          console.log(`[Precanned API] ✅ File exists at: ${sourcePath} (${stats.size} bytes)`);
          fileBuffer = await fs.readFile(sourcePath);
          console.log(`[Precanned API] ✅ Served from source: ${sourcePath} (${fileBuffer.length} bytes)`);
          fileFound = true;
          break;
        } catch (pathError: any) {
          // Continue to next path
          console.log(`[Precanned API] Path not found: ${sourcePath} (${pathError.code || pathError.message})`);
        }
      }
      
      if (!fileFound) {
        console.error(`[Precanned API] ❌ File not found in any location: ${filename}`);
        console.error(`[Precanned API] Tried ${possiblePaths.length} paths`);
        
        // Try to list files in the uploads directory for debugging
        if (validBaseDir) {
          try {
            const uploadsDir = path.join(validBaseDir, "uploads");
            const files = await fs.readdir(uploadsDir);
            console.log(`[Precanned API] Files in ${uploadsDir}: ${files.join(", ")}`);
          } catch (listError: any) {
            console.error(`[Precanned API] Could not list uploads directory: ${listError.message}`);
          }
        }
        
        return NextResponse.json({ 
          error: "File not found",
          details: {
            filename,
            triedPaths: possiblePaths,
            validBaseDir,
            processCwd: process.cwd()
          }
        }, { status: 404 });
      }
    }
    
    // Ensure we have a file buffer
    if (!fileBuffer) {
      console.error(`[Precanned API] ❌ No file buffer after all attempts`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

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
      case ".svg":
        mimeType = "image/svg+xml";
        break;
    }

    // Return the file
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("[Precanned API] Failed to serve file:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}

