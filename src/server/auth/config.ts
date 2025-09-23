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
			role: "user" | "admin";
		} & DefaultSession["user"];
	}

	interface User {
		role: "user" | "admin";
	}
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
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
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				// Find user by email
				const user = await db
					.select()
					.from(users)
					.where(eq(users.email, credentials.email.toLowerCase()))
					.limit(1);

				if (user.length === 0 || !user[0].password) {
					return null;
				}

				// Verify password
				const isValid = await bcrypt.compare(
					credentials.password,
					user[0].password
				);

				if (!isValid) {
					return null;
				}

				return {
					id: user[0].id,
					email: user[0].email,
					name: user[0].name,
					role: user[0].role,
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
		session: ({ session, user }) => ({
			...session,
			user: {
				...session.user,
				id: user.id,
				role: user.role || "user",
			},
		}),
		async signIn({ user, account }) {
			// Ensure all users have a role (default to "user")
			if (user.id && !user.role) {
				const existingUser = await db
					.select()
					.from(users)
					.where(eq(users.id, user.id))
					.limit(1);

				if (existingUser.length > 0 && !existingUser[0].role) {
					await db
						.update(users)
						.set({ role: "user" })
						.where(eq(users.id, user.id));
				}
			}
			return true;
		},
	},
} satisfies NextAuthConfig;
