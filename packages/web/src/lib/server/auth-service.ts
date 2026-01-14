import type { Session } from "@auth/sveltekit";
import type { RequestEvent } from "@sveltejs/kit";
import { GuestUserService } from "@task-manager/db";

export interface AuthResult {
	userId: string;
	isGuest: boolean;
	session: Session | null;
}

/**
 * Get user authentication status and ID for both authenticated and guest users
 */
export async function getAuthStatus(
	event: RequestEvent,
): Promise<AuthResult | null> {
	try {
		// Try authenticated user first
		const session = await event.locals.auth();

		if (session?.user?.id) {
			return {
				userId: session.user.id,
				isGuest: false,
				session,
			};
		}

		// Check for guest user
		const guestId =
			event.request.headers.get("x-guest-id") || event.cookies.get("guest-id");

		if (guestId) {
			// Validate guest user exists and hasn't expired
			const guestUserService = new GuestUserService();
			const guestUser = await guestUserService.getGuestUser(guestId);

			if (guestUser) {
				return {
					userId: guestId,
					isGuest: true,
					session: null,
				};
			}
		}

		return null;
	} catch (error) {
		console.error("Auth status check failed:", error);
		return null;
	}
}

/**
 * Require authentication (authenticated users only)
 */
export async function requireAuth(event: RequestEvent): Promise<Session> {
	const session = await event.locals.auth();

	if (!session?.user?.id) {
		throw new Error("Authentication required");
	}

	return session;
}

/**
 * Get session safely (returns null if not authenticated)
 */
export async function getSession(event: RequestEvent): Promise<Session | null> {
	try {
		return await event.locals.auth();
	} catch (error) {
		console.error("Failed to get session:", error);
		return null;
	}
}
