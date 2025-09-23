import type { Session } from "next-auth";

/**
 * Check if the current user is an admin
 */
export function isAdmin(session: Session | null): boolean {
	return session?.user?.role === "admin";
}

/**
 * Check if the current user is authenticated
 */
export function isAuthenticated(session: Session | null): session is Session {
	return session !== null && session.user !== undefined;
}

/**
 * Require admin role or throw an error
 */
export function requireAdmin(session: Session | null): void {
	if (!isAdmin(session)) {
		throw new Error("Unauthorized: Admin access required");
	}
}

/**
 * Require authentication or throw an error
 */
export function requireAuth(session: Session | null): asserts session is Session {
	if (!isAuthenticated(session)) {
		throw new Error("Unauthorized: Authentication required");
	}
}