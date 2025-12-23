#!/usr/bin/env node
/**
 * Script to fix a purchase status (mark as completed)
 * Usage: npm run fix-purchase <purchaseId> [paymentIntentId]
 * Example: npm run fix-purchase dee7470f-8f91-462b-a47e-8e74f5dbc3ca pi_3Shb3a2Hrig2hy470dv5nFZB
 */

// Set DATABASE_URL before importing db module
if (process.env.RENDER === "true" || process.cwd().includes("/opt/render")) {
	process.env.DATABASE_URL = "file:/var/data/db.sqlite";
} else if (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes("build") || process.env.DATABASE_URL.includes("build-db"))) {
	process.env.DATABASE_URL = "file:./dev.db";
} else if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL = "file:./dev.db";
}

import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function fixPurchase(purchaseId: string, paymentIntentId?: string) {
	try {
		console.log(`Looking for purchase: ${purchaseId}`);
		console.log(`Using database: ${process.env.DATABASE_URL}`);

		// Find the purchase
		const [purchase] = await db
			.select()
			.from(purchases)
			.where(eq(purchases.id, purchaseId))
			.limit(1);

		if (!purchase) {
			console.error(`❌ Purchase ${purchaseId} not found`);
			process.exit(1);
		}

		console.log(`Found purchase:`, {
			id: purchase.id,
			userId: purchase.userId,
			status: purchase.status,
			featureType: purchase.featureType,
			amount: purchase.amount,
			paymentIntentId: purchase.paymentIntentId,
			bookId: purchase.bookId,
		});

		if (purchase.status === "completed") {
			console.log(`ℹ️  Purchase ${purchaseId} is already completed`);
			process.exit(0);
		}

		// Update the purchase
		const updateData: any = {
			status: "completed",
			completedAt: new Date(),
			updatedAt: new Date(),
		};

		if (paymentIntentId) {
			updateData.paymentIntentId = paymentIntentId;
			console.log(`Will update paymentIntentId to: ${paymentIntentId}`);
		}

		await db
			.update(purchases)
			.set(updateData)
			.where(eq(purchases.id, purchaseId));

		console.log(`✅ Successfully updated purchase ${purchaseId} to completed status`);

		// Verify the update
		const [updatedPurchase] = await db
			.select()
			.from(purchases)
			.where(eq(purchases.id, purchaseId))
			.limit(1);

		if (updatedPurchase) {
			console.log(`Verified purchase status:`, {
				id: updatedPurchase.id,
				status: updatedPurchase.status,
				paymentIntentId: updatedPurchase.paymentIntentId,
				completedAt: updatedPurchase.completedAt,
			});
		}

		process.exit(0);
	} catch (error) {
		console.error("❌ Error fixing purchase:", error);
		process.exit(1);
	}
}

// Get command line arguments
const purchaseId = process.argv[2];
const paymentIntentId = process.argv[3];

if (!purchaseId) {
	console.error("Usage: npm run fix-purchase <purchaseId> [paymentIntentId]");
	console.error("Example: npm run fix-purchase dee7470f-8f91-462b-a47e-8e74f5dbc3ca pi_3Shb3a2Hrig2hy470dv5nFZB");
	process.exit(1);
}

fixPurchase(purchaseId, paymentIntentId);

