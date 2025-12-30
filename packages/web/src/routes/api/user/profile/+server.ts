import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

/**
 * GET /api/user/profile
 * Returns the current user's profile data from DynamoDB
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get full user data from DynamoDB
		const user = await getUserFromDatabase(session.user.id);

		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		// Return user profile (excluding sensitive data)
		const profile = {
			id: user.id,
			notionUserId: user.notionUserId,
			email: user.email,
			name: user.name,
			avatarUrl: user.avatarUrl,
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
			// Don't expose the access token in API responses
		};

		return json({ success: true, data: profile });
	} catch (error) {
		console.error("Failed to get user profile:", error);
		return json({ error: "Failed to retrieve user profile" }, { status: 500 });
	}
};

/**
 * PUT /api/user/profile
 * Updates the current user's profile data
 */
export const PUT: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Parse request body
		const updates = await event.request.json();
		const { name, email, avatarUrl } = updates;

		// Validate updates
		if (!name && !email && !avatarUrl) {
			return json(
				{
					error: "At least one field (name, email, avatarUrl) must be provided",
				},
				{ status: 400 },
			);
		}

		// Update user in DynamoDB
		const userService = new (
			await import("@notion-task-manager/db")
		).UserService();
		const updatedUser = await userService.updateUser(session.user.id, {
			...(name && { name }),
			...(email && { email }),
			...(avatarUrl !== undefined && { avatarUrl }),
		});

		// Return updated profile
		const profile = {
			id: updatedUser.id,
			notionUserId: updatedUser.notionUserId,
			email: updatedUser.email,
			name: updatedUser.name,
			avatarUrl: updatedUser.avatarUrl,
			createdAt: updatedUser.createdAt.toISOString(),
			updatedAt: updatedUser.updatedAt.toISOString(),
		};

		return json({ success: true, data: profile });
	} catch (error) {
		console.error("Failed to update user profile:", error);

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "User not found" }, { status: 404 });
		}

		return json({ error: "Failed to update user profile" }, { status: 500 });
	}
};
