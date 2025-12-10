import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name: rawName, currentPassword, newPassword } = await request.json();

    // Sanitize user input to prevent XSS attacks
    const { sanitizeTitle } = await import("@/server/utils/sanitize-input");
    const name = rawName ? sanitizeTitle(rawName) : null;

    // Get current user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = user[0]!;
    const updateData: any = {};

    // Update name if provided (use sanitized value)
    if (name && name !== userData.name) {
      updateData.name = name;
    }

    // Update password if provided
    if (newPassword) {
      // Verify current password
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }

      if (!userData.password) {
        return NextResponse.json(
          { error: "Cannot change password for OAuth accounts" },
          { status: 400 }
        );
      }

      const isValidPassword = await bcrypt.compare(currentPassword, userData.password);
      if (!isValidPassword) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      // Hash new password
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Update user if there are changes
    if (Object.keys(updateData).length > 0) {
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, session.user.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}