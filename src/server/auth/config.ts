import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { db } from "@/server/db";
import {
	accounts,
	sessions,
	users,
	verificationTokens,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { trackUserActivity } from "@/server/services/analytics";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			role: "user" | "admin" | "super_admin";
		} & DefaultSession["user"];
	}

	interface User {
		role: "user" | "admin" | "super_admin";
	}
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	session: {
		strategy: "jwt", // Use JWT for both OAuth and credentials
	},
	pages: {
		signIn: "/login",
		error: "/login",
		verifyRequest: "/auth/verify-email",
	},
	providers: [
		GoogleProvider({
			allowDangerousEmailAccountLinking: true,
		}),
		CredentialsProvider({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				console.log("Authorize called with email:", credentials?.email);

				if (!credentials?.email || !credentials?.password) {
					console.log("Missing credentials");
					return null;
				}

				// Find user by email
				const user = await db
					.select()
					.from(users)
					.where(eq(users.email, credentials.email.toLowerCase()))
					.limit(1);

				console.log("User found:", user.length > 0 ? "Yes" : "No");

				if (user.length === 0) {
					console.log("User not found");
					return null;
				}

				if (!user[0].password) {
					console.log("User has no password (OAuth only user)");
					// This is an OAuth user trying to login with credentials
					throw new Error("OAUTH_USER");
				}

				// Verify password
				const isValid = await bcrypt.compare(
					credentials.password,
					user[0].password
				);

				console.log("Password valid:", isValid);

				if (!isValid) {
					return null;
				}

				// Check if email is verified (commented out for now to allow login)
				// if (!user[0].emailVerified) {
				//	throw new Error("Please verify your email before signing in");
				// }

				console.log("Returning user:", user[0].id);

				return {
					id: user[0].id,
					email: user[0].email,
					name: user[0].name,
					role: user[0].role || "user",
				};
			},
		}),
	],
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens,
	}),
	callbacks: {
		async jwt({ token, user, trigger }) {
			// Handle token errors gracefully
			if (!token) {
				return null;
			}
			// Persist the user info in the JWT token
			if (user) {
				token.id = user.id;
				token.role = user.role || "user";
				token.email = user.email;
			}

			// Validate that the user still exists in the database and check super admin
			if (token.id) {
				const existingUser = await db
					.select()
					.from(users)
					.where(eq(users.id, token.id as string))
					.limit(1);

				// If user doesn't exist, return null to invalidate the session
				if (existingUser.length === 0) {
					return null;
				}

				const currentUser = existingUser[0];

				// Check if user should be super admin
				const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
				const isSuperAdmin = currentUser.email && superAdminEmails.includes(currentUser.email);

				// Promote to super_admin if in SUPER_ADMIN_EMAILS list and not already super_admin
				if (isSuperAdmin && currentUser.role !== "super_admin") {
					await db
						.update(users)
						.set({
							role: "super_admin",
							updatedAt: new Date()
						})
						.where(eq(users.id, token.id as string));
					token.role = "super_admin";
				} else {
					// Use the role from database
					token.role = currentUser.role || "user";
				}
			}

			return token;
		},
		session: async ({ session, user, token }) => {
			// Handle session errors gracefully
			if (!session || !token) {
				return null as any;
			}
			// Track user activity for DAU
			let userId: string | undefined;

			// For OAuth providers, user will be available
			// For credentials provider, use token
			if (user) {
				userId = user.id;
				session = {
					...session,
					user: {
						...session.user,
						id: user.id,
						role: user.role || "user",
					},
				};
			} else if (token) {
				userId = token.id as string;
				session = {
					...session,
					user: {
						...session.user,
						id: token.id as string,
						role: (token.role as string) || "user",
					},
				};
			}

			// Track activity (fire and forget)
			if (userId) {
				trackUserActivity(userId).catch(console.error);
			}

			return session;
		},
		async signIn({ user, account }) {
			// Check if user should be super admin
			const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
			const isSuperAdmin = user.email && superAdminEmails.includes(user.email);

			if (user.id) {
				const existingUser = await db
					.select()
					.from(users)
					.where(eq(users.id, user.id))
					.limit(1);

				if (existingUser.length > 0) {
					const currentUser = existingUser[0];

					// Promote to super_admin if in SUPER_ADMIN_EMAILS list and not already super_admin
					if (isSuperAdmin && currentUser.role !== "super_admin") {
						await db
							.update(users)
							.set({
								role: "super_admin",
								updatedAt: new Date()
							})
							.where(eq(users.id, user.id));
						user.role = "super_admin";
					}
					// Set default role if no role exists
					else if (!currentUser.role) {
						await db
							.update(users)
							.set({
								role: "user",
								updatedAt: new Date()
							})
							.where(eq(users.id, user.id));
						user.role = "user";
					} else {
						// Keep existing role
						user.role = currentUser.role as "user" | "admin" | "super_admin";
					}
				}
			}
			return true;
		},
	},
} satisfies NextAuthConfig;
