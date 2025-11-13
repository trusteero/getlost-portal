import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { reports } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { id } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get session to get user email for analyzedBy field
  const { getSessionFromRequest } = await import("@/server/auth");
  const session = await getSessionFromRequest(request);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [existingReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (!existingReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Check file type
    const fileType = file.type;
    const isHtml = fileType === "text/html" || file.name.endsWith(".html");
    const isPdf = fileType === "application/pdf" || file.name.endsWith(".pdf");

    if (!isHtml && !isPdf) {
      return NextResponse.json({ error: "File must be HTML or PDF" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const reportStoragePath =
      process.env.REPORT_STORAGE_PATH || "./uploads/reports";
    const reportDir = path.resolve(reportStoragePath);
    await fs.mkdir(reportDir, { recursive: true });

    const originalExt = path.extname(file.name);
    const lowerExt = originalExt ? originalExt.toLowerCase() : "";
    const targetExt = isHtml ? ".html" : lowerExt || (isPdf ? ".pdf" : "");
    const storedFileName = `${id}${targetExt}`;
    const storedFilePath = path.join(reportDir, storedFileName);
    await fs.writeFile(storedFilePath, fileBuffer);

    const htmlContent = isHtml
      ? fileBuffer.toString("utf-8")
      : existingReport.htmlContent;
    const pdfUrl = isPdf
      ? `/uploads/reports/${storedFileName}`
      : existingReport.pdfUrl;

    // Update report
    await db
      .update(reports)
      .set({
        status: "completed",
        htmlContent,
        pdfUrl,
        completedAt: new Date(),
        analyzedBy: session.user.email,
      })
      .where(eq(reports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to upload report:", error);
    return NextResponse.json({ error: "Failed to upload report" }, { status: 500 });
  }
}