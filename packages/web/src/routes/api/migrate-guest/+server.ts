import { json } from "@sveltejs/kit";
import { GuestUserService } from "@task-manager/db";
import type { RequestHandler } from "./$types";

/**
 * POST /api/migrate-guest
 * Transfers guest workspace ownership to a newly authenticated user
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Verify user is authenticated
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		// Only allow this for new users
		if (!session.user.isNewUser) {
			return json(
				{ error: "Migration only available for new users" },
				{ status: 403 },
			);
		}

		const { guestId } = await event.request.json();

		if (!guestId || typeof guestId !== "string") {
			return json({ error: "Guest ID is required" }, { status: 400 });
		}

		const guestUserService = new GuestUserService();
		const result = await guestUserService.transferGuestWorkspace(
			guestId,
			session.user.id,
		);

		if (result.success) {
			return json({
				success: true,
				workspaceId: result.workspaceId,
				message: result.message,
			});
		} else {
			return json(
				{
					success: false,
					message: result.message,
				},
				{ status: 400 },
			);
		}
	} catch (error) {
		console.error("Failed to migrate guest workspace:", error);
		return json(
			{ error: "Failed to migrate guest workspace" },
			{ status: 500 },
		);
	}
};
