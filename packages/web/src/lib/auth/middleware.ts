/**
 * Centralized authentication middleware for API routes
 * Eliminates duplicate auth/guest validation logic across routes
 */

import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";

export interface AuthResult {
	userId: string;
	isGuest: boolean;
	session?: any;
}

/**
 * Validates authentication for both authenticated users and guests
 * Replaces duplicate auth logic in multiple API routes
 */
export async function requireAuthOrGuest(
	event: RequestEvent,
): Promise<AuthResult> {
	// Try authenticated user first
	try {
		const session = await event.locals.auth();
		if (session?.user?.id) {
			return {
				userId: session.user.id,
				isGuest: false,
				session,
			};
		}
	} catch {
		// Fall through to guest validation
	}

	// Check for guest user ID in headers or cookies
	const guestId =
		event.request.headers.get("x-guest-id") || event.cookies.get("guest-id");

	if (!guestId) {
		throw json(
			{ error: "Authentication required or guest ID missing" },
			{ status: 401 },
		);
	}

	// Validate guest user exists
	await validateGuestUser(guestId);

	return {
		userId: guestId,
		isGuest: true,
	};
}

/**
 * Validates that a guest user still exists in the system
 */
async function validateGuestUser(guestId: string): Promise<void> {
	try {
		const { GuestUserService } = await import("@notion-task-manager/db");
		const guestUserService = new GuestUserService();
		const guestUser = await guestUserService.getGuestUser(guestId);

		if (!guestUser) {
			throw json(
				{ error: "Guest session expired. Please refresh the page." },
				{ status: 401 },
			);
		}
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		throw json({ error: "Failed to validate guest session" }, { status: 500 });
	}
}

/**
 * Requires authenticated user only (no guests)
 */
export async function requireAuth(event: RequestEvent) {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw json({ error: "Authentication required" }, { status: 401 });
	}
	return session;
}
