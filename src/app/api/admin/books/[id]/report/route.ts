import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookVersions, reports } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get the latest version of the book
    const [latestVersion] = await db
      .select()
      .from(bookVersions)
      .where(eq(bookVersions.bookId, id))
      .orderBy(desc(bookVersions.uploadedAt))
      .limit(1);

    if (!latestVersion) {
      return NextResponse.json({ error: "No book version found" }, { status: 404 });
    }

    // Check if there's an existing report for this version
    let [existingReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.bookVersionId, latestVersion.id))
      .orderBy(desc(reports.requestedAt))
      .limit(1);

    // Save the report file to disk
    const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';
    const reportDir = path.resolve(reportStoragePath);

    // Create directory if it doesn't exist
    await fs.mkdir(reportDir, { recursive: true });

    // Generate report ID
    const reportId = existingReport?.id || crypto.randomUUID();

    // Save file with report ID as name (preserving extension for download)
    const fileExt = path.extname(file.name);
    const storedFileName = `${reportId}${fileExt}`;
    const reportFilePath = path.join(reportDir, storedFileName);

    // Save report file to disk
    const fileBytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileBytes);
    await fs.writeFile(reportFilePath, fileBuffer);

    // If no existing report, create one
    if (!existingReport) {
      await db
        .insert(reports)
        .values({
          id: reportId,
          bookVersionId: latestVersion.id,
          status: "completed",
          requestedAt: new Date(),
          completedAt: new Date(),
          analyzedBy: session.user.id,
        });
    } else {
      // Update existing report
      await db
        .update(reports)
        .set({
          status: "completed",
          completedAt: new Date(),
          analyzedBy: session.user.id,
        })
        .where(eq(reports.id, existingReport.id));
    }

    return NextResponse.json({
      success: true,
      reportId,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Failed to upload report:", error);
    return NextResponse.json(
      { error: "Failed to upload report" },
      { status: 500 }
    );
  }
}