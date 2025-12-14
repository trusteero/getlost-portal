import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    return apiErrors.unauthorized();
  }

  // Rate limiting for user settings endpoint
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "user:settings",
    RATE_LIMITS.API,
    session.user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
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
      return apiErrors.notFound("User");
    }

    const userData = user[0]!;
    const updateData: {
      name?: string;
      password?: string;
    } = {};

    // Update name if provided (use sanitized value)
    if (name && name !== userData.name) {
      updateData.name = name;
    }

    // Update password if provided
    if (newPassword) {
      // Verify current password
      if (!currentPassword) {
        return apiErrors.badRequest("Current password is required", "MISSING_REQUIRED_FIELD");
      }

      if (!userData.password) {
        return apiErrors.badRequest("Cannot change password for OAuth accounts");
      }

      const isValidPassword = await bcrypt.compare(currentPassword, userData.password);
      if (!isValidPassword) {
        return apiErrors.badRequest("Current password is incorrect", "VALIDATION_ERROR");
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
    return apiErrors.internal("Failed to update settings", error);
  }
}