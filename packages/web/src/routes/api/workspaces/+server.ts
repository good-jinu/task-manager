import { ValidationError, WorkspaceService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/workspaces
 * Returns all workspaces for the authenticated user or guest user
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Check if user is authenticated or guest
		let _userId: string;
		let isGuest = false;

		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			_userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			_userId = guestId;
			isGuest = true;
		}

		const workspaceService = new WorkspaceService();

		// For guest users, validate that the guest user still exists
		if (isGuest) {
			try {
				const { GuestUserService } = await import("@notion-task-manager/db");
				const guestUserService = new GuestUserService();
				const guestUser = await guestUserService.getGuestUser(_userId);

				if (!guestUser) {
					// Guest user expired or doesn't exist
					return json({ error: "Guest user expired" }, { status: 401 });
				}
			} catch (guestError) {
				console.error("Failed to validate guest user:", guestError);
				return json({ error: "Guest user validation failed" }, { status: 401 });
			}
		}

		const workspaces = await workspaceService.listWorkspaces(_userId);

		return json({
			success: true,
			workspaces: workspaces,
		});
	} catch (error) {
		console.error("Failed to get workspaces:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json({ error: "Failed to retrieve workspaces" }, { status: 500 });
	}
};

/**
 * POST /api/workspaces
 * Creates a new workspace for the authenticated user or guest user
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Check if user is authenticated or guest
		let _userId: string;
		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			_userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			_userId = guestId;
		}

		const workspaceData = await event.request.json();

		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.createWorkspace(
			_userId,
			workspaceData,
		);

		return json(
			{
				success: true,
				data: workspace,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to create workspace:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: "Failed to create workspace" }, { status: 500 });
	}
};
