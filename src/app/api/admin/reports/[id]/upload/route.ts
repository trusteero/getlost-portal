import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { reports } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  if (session.user.role !== "admin" && !adminEmails.includes(session.user.email || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
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

    let htmlContent = null;
    let pdfUrl = null;

    if (isHtml) {
      // Read HTML content
      htmlContent = await file.text();
    } else if (isPdf) {
      // TODO: Upload PDF to storage and get URL
      pdfUrl = `/uploads/reports/${params.id}/${file.name}`;
    }

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