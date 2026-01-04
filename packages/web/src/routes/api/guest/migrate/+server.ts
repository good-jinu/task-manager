import { GuestUserService, ValidationError } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * POST /api/guest/migrate
 * Migrates guest user tasks to a permanent authenticated user account
 * Request body: { guestId: string }
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Require authentication - user must be signed in to migrate
		const session = await requireAuth(event);

		const { guestId } = await event.request.json();

		if (!guestId) {
			return json({ error: "guestId is required" }, { status: 400 });
		}

		const guestUserService = new GuestUserService();
		const migrationResult = await guestUserService.migrateGuestTasks(
			guestId,
			session.user.id,
		);

		// Clear guest ID cookie since tasks are now migrated
		event.cookies.delete("guest-id", { path: "/" });

		return json({
			success: true,
			data: migrationResult,
		});
	} catch (error) {
		console.error("Failed to migrate guest tasks:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof Error && error.message.includes("not found")) {
			return json(
				{ error: "Guest user not found or already migrated" },
				{ status: 404 },
			);
		}

		return json({ error: "Failed to migrate guest tasks" }, { status: 500 });
	}
};
