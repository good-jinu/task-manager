import { GuestUserService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * POST /api/guest/extend
 * Extends the TTL for the current guest user session
 */
export const POST: RequestHandler = async (event) => {
	try {
		const guestId = event.cookies.get("guest-id");

		if (!guestId) {
			return json({ error: "No guest session found" }, { status: 401 });
		}

		const guestUserService = new GuestUserService();
		const extendedGuest = await guestUserService.extendGuestSession(guestId);

		if (!extendedGuest) {
			// Guest user doesn't exist, clear the invalid cookie
			event.cookies.delete("guest-id", { path: "/" });
			return json({ error: "Guest session expired" }, { status: 401 });
		}

		// Extend the cookie as well
		event.cookies.set("guest-id", guestId, {
			path: "/",
			maxAge: 60 * 60 * 24 * 365, // 1 year to match database TTL
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});

		return json({
			success: true,
			data: {
				guestId: extendedGuest.id,
				expiresAt: extendedGuest.expiresAt,
			},
		});
	} catch (error) {
		console.error("Failed to extend guest session:", error);
		return json({ error: "Failed to extend guest session" }, { status: 500 });
	}
};
