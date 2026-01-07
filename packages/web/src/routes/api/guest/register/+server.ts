import { GuestUserService, ValidationError } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * POST /api/guest/register
 * Creates a new guest user with a default workspace
 * Returns guest ID and workspace ID for client-side storage
 */
export const POST: RequestHandler = async (event) => {
	try {
		const guestUserService = new GuestUserService();

		// Generate guest ID
		const guestId = guestUserService.generateGuestId();

		// Create default workspace for guest user
		const workspace = await guestUserService.createGuestWorkspace(guestId);

		// Set guest ID in cookie for future requests with 7-day expiration to match database TTL
		event.cookies.set("guest-id", guestId, {
			path: "/",
			maxAge: 60 * 60 * 24 * 7, // 7 days to match database TTL
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});

		return json(
			{
				success: true,
				data: {
					guestId,
					workspace,
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to register guest user:", error);

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: "Failed to register guest user" }, { status: 500 });
	}
};
