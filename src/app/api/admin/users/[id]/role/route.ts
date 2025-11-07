import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin or super_admin
  const currentUserRole = (session.user as any)?.role;
  if (currentUserRole !== "admin" && currentUserRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { role } = await request.json();
    const { id } = await params;

    // Validate role
    if (!["user", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'user' or 'admin'" },
        { status: 400 }
      );
    }

    // Get target user
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const target = targetUser[0]!;

    // Prevent changing super_admin roles
    if (target.role === "super_admin") {
      return NextResponse.json(
        { error: "Cannot change super admin role" },
        { status: 403 }
      );
    }

    // Only super_admins can promote to admin
    if (role === "admin" && currentUserRole !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can promote users to admin" },
        { status: 403 }
      );
    }

    // Update user role
    await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error("Failed to update user role:", error);
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
  }
}