/**
 * Centralized authentication middleware for API routes
 * Eliminates duplicate auth/guest validation logic across routes
 */

import type { Session } from "@auth/sveltekit";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";

export interface AuthResult {
	userId: string;
	isGuest: boolean;
	session?: Session;
}

/**
 * Validates authentication for both authenticated users and guests
 * Replaces duplicate auth logic in multiple API routes
 */
export async function requireAuthOrGuest(
	event: RequestEvent,
): Promise<AuthResult> {
	console.log("[requireAuthOrGuest] Starting auth check");

	// Try authenticated user first
	try {
		const session = await event.locals.auth();
		console.log("[requireAuthOrGuest] Session check:", {
			hasSession: !!session,
			userId: session?.user?.id,
		});
		if (session?.user?.id) {
			console.log(
				"[requireAuthOrGuest] Authenticated user found:",
				session.user.id,
			);
			return {
				userId: session.user.id,
				isGuest: false,
				session,
			};
		}
	} catch (error) {
		console.log("[requireAuthOrGuest] Session check failed:", error);
		// Fall through to guest validation
	}

	// Check for guest user ID in headers or cookies
	const guestId =
		event.request.headers.get("x-guest-id") || event.cookies.get("guest-id");

	console.log("[requireAuthOrGuest] Guest ID check:", { guestId });

	if (!guestId) {
		console.error("[requireAuthOrGuest] No guest ID found, returning 401");
		throw json(
			{ error: "Authentication required or guest ID missing" },
			{ status: 401 },
		);
	}

	// Validate guest user exists
	console.log("[requireAuthOrGuest] Validating guest user:", guestId);
	await validateGuestUser(guestId);
	console.log("[requireAuthOrGuest] Guest user validated successfully");

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
		const { GuestUserService } = await import("@task-manager/db");
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
