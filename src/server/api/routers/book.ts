import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import {
	createTRPCRouter,
	protectedProcedure,
} from "@/server/api/trpc";
import { books } from "@/server/db/schema";

export const bookRouter = createTRPCRouter({
	// Get all books for the logged-in user
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const allBooks = await ctx.db.query.books.findMany({
			where: eq(books.userId, ctx.session.user.id),
			orderBy: [desc(books.createdAt)],
		});
		return allBooks;
	}),

	// Get a single book by ID
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const book = await ctx.db.query.books.findFirst({
				where: eq(books.id, input.id),
			});

			// Ensure user owns the book
			if (book && book.userId !== ctx.session.user.id) {
				throw new Error("Unauthorized");
			}

			return book ?? null;
		}),

	// Create a new book entry
	create: protectedProcedure
		.input(
			z.object({
				title: z.string().min(1).max(512),
				author: z.string().max(256).optional(),
				isbn: z.string().max(20).optional(),
				description: z.string().optional(),
				fileName: z.string().max(512),
				filePath: z.string().max(1024),
				fileSize: z.number().optional(),
				mimeType: z.string().max(100).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [newBook] = await ctx.db
				.insert(books)
				.values({
					...input,
					userId: ctx.session.user.id,
				})
				.returning();

			return newBook;
		}),

	// Update a book
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1).max(512).optional(),
				author: z.string().max(256).optional(),
				isbn: z.string().max(20).optional(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updates } = input;

			// Verify ownership
			const existingBook = await ctx.db.query.books.findFirst({
				where: eq(books.id, id),
			});

			if (!existingBook || existingBook.userId !== ctx.session.user.id) {
				throw new Error("Unauthorized");
			}

			const [updatedBook] = await ctx.db
				.update(books)
				.set(updates)
				.where(eq(books.id, id))
				.returning();

			return updatedBook;
		}),

	// Delete a book
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const existingBook = await ctx.db.query.books.findFirst({
				where: eq(books.id, input.id),
			});

			if (!existingBook || existingBook.userId !== ctx.session.user.id) {
				throw new Error("Unauthorized");
			}

			await ctx.db.delete(books).where(eq(books.id, input.id));

			return { success: true };
		}),
});

