import { GuestUserService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const guestUserService = new GuestUserService();

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	try {
		// Check if user is authenticated
		const session = await locals.getSession();
		if (!session?.user?.id) {
			return json(
				{
					success: false,
					error: "Authentication required for migration",
				},
				{ status: 401 },
			);
		}

		const { guestId } = await request.json();

		if (
			!guestId ||
			typeof guestId !== "string" ||
			!guestId.startsWith("guest_")
		) {
			return json(
				{
					success: false,
					error: "Valid guest ID is required",
				},
				{ status: 400 },
			);
		}

		// Verify the guest user exists
		const guestUser = await guestUserService.getGuestUser(guestId);
		if (!guestUser) {
			return json(
				{
					success: false,
					error: "Guest user not found",
				},
				{ status: 404 },
			);
		}

		// Migrate guest tasks to the authenticated user
		const migrationResult = await guestUserService.migrateGuestTasks(
			guestId,
			session.user.id,
		);

		// Clear guest cookie after successful migration
		cookies.delete("guest-id", { path: "/" });

		return json({
			success: true,
			data: migrationResult,
		});
	} catch (error) {
		console.error("Failed to migrate guest tasks:", error);
		return json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to migrate guest tasks",
			},
			{ status: 500 },
		);
	}
};
