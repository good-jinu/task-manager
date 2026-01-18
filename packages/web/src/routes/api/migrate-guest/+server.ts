import { json } from "@sveltejs/kit";
import { GuestUserService } from "@task-manager/db";
import type { RequestHandler } from "./$types";

/**
 * POST /api/migrate-guest
 * Transfers guest workspace ownership to a newly authenticated user
 */
export const POST: RequestHandler = async (event) => {
	console.log("[migrate-guest] Starting migration request");

	try {
		// Verify user is authenticated
		const session = await event.locals.auth();
		console.log("[migrate-guest] Session check", {
			hasSession: !!session,
			userId: session?.user?.id,
			isNewUser: session?.user?.isNewUser,
		});

		if (!session?.user?.id) {
			console.log("[migrate-guest] Authentication required");
			return json({ error: "Authentication required" }, { status: 401 });
		}

		// Only allow this for new users
		if (!session.user.isNewUser) {
			console.log("[migrate-guest] Migration rejected - not a new user", {
				userId: session.user.id,
			});
			return json(
				{ error: "Migration only available for new users" },
				{ status: 403 },
			);
		}

		const { guestId } = await event.request.json();
		console.log("[migrate-guest] Request data", { guestId });

		if (!guestId || typeof guestId !== "string") {
			console.log("[migrate-guest] Invalid guest ID");
			return json({ error: "Guest ID is required" }, { status: 400 });
		}

		console.log("[migrate-guest] Initiating workspace transfer", {
			guestId,
			permanentUserId: session.user.id,
		});

		const guestUserService = new GuestUserService();
		const result = await guestUserService.transferGuestWorkspace(
			guestId,
			session.user.id,
		);

		console.log("[migrate-guest] Transfer result", {
			success: result.success,
			workspaceId: result.workspaceId,
			message: result.message,
		});

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
		console.error("[migrate-guest] Failed to migrate guest workspace:", error);
		return json(
			{ error: "Failed to migrate guest workspace" },
			{ status: 500 },
		);
	}
};
