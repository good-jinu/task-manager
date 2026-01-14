import { json } from "@sveltejs/kit";
import { GuestUserService } from "@task-manager/db";
import type { RequestHandler } from "./$types";

const guestUserService = new GuestUserService();

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	try {
		// Check if user is authenticated
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json(
				{
					success: false,
					error: "Authentication required for migration",
				},
				{ status: 401 },
			);
		}

		const { tasks } = await request.json();

		if (!tasks || !Array.isArray(tasks)) {
			return json(
				{
					success: false,
					error: "Tasks array is required",
				},
				{ status: 400 },
			);
		}

		// Get guest ID from cookie or header
		const guestId =
			request.headers.get("x-guest-id") || cookies.get("guest-id");

		if (!guestId) {
			return json(
				{
					success: false,
					error: "Guest ID not found",
				},
				{ status: 400 },
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
