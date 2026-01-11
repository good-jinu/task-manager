import type { RequestEvent } from "@sveltejs/kit";
import { getAuthStatus, getSession } from "./auth-service";
import {
	createErrorFallback,
	loadAuthenticatedUserData,
	loadGuestUserData,
	type PageData,
} from "./data-loader";

/**
 * Load page data based on authentication status
 */
export async function loadPageData(event: RequestEvent): Promise<PageData> {
	try {
		const authResult = await getAuthStatus(event);
		const session = await getSession(event);

		if (authResult && !authResult.isGuest) {
			// Authenticated user - load full data
			const userData = await loadAuthenticatedUserData(authResult.userId);

			return {
				session,
				...userData,
			} as PageData;
		} else if (authResult?.isGuest) {
			// Guest user - return minimal data
			const guestData = loadGuestUserData();

			return {
				session,
				...guestData,
			} as PageData;
		} else {
			// No authentication - return minimal data
			const fallbackData = loadGuestUserData();

			return {
				session,
				...fallbackData,
			} as PageData;
		}
	} catch (error) {
		console.error("Failed to load page data:", error);

		// Return error fallback data
		const session = await getSession(event);
		return createErrorFallback(session);
	}
}
