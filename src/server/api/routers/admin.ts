import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const adminRouter = createTRPCRouter({
	// Get all users (admin only)
	getAllUsers: adminProcedure.query(async ({ ctx }) => {
		const allUsers = await ctx.db.select().from(users);
		return allUsers;
	}),

	// Update user role (admin only)
	updateUserRole: adminProcedure
		.input(
			z.object({
				userId: z.string(),
				role: z.enum(["user", "admin"]),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// Prevent admin from removing their own admin role
			if (input.userId === ctx.session.user.id && input.role !== "admin") {
				throw new Error("Cannot remove your own admin role");
			}

			await ctx.db
				.update(users)
				.set({ role: input.role })
				.where(eq(users.id, input.userId));

			return { success: true };
		}),

	// Get user stats (admin only)
	getUserStats: adminProcedure.query(async ({ ctx }) => {
		const allUsers = await ctx.db.select().from(users);
		const adminCount = allUsers.filter((u) => u.role === "admin").length;
		const userCount = allUsers.filter((u) => u.role === "user").length;

		return {
			total: allUsers.length,
			admins: adminCount,
			users: userCount,
		};
	}),
});