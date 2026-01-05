import { createAIAgentService } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
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

		// For authenticated users, get user data from database
		// For guest users, we'll use the guest ID directly
		if (!isGuest) {
			const user = await getUserFromDatabase(_userId);
			if (!user) {
				return json({ error: "User not found in database" }, { status: 404 });
			}
		}

		const requestBody = await event.request.json();
		const { workspaceId } = requestBody;

		// Validate required fields
		if (
			!workspaceId ||
			typeof workspaceId !== "string" ||
			!workspaceId.trim()
		) {
			return json(
				{ error: "Workspace ID is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Create AI agent service
		const aiService = createAIAgentService();

		// Get task recommendations
		const recommendations = await aiService.getTaskRecommendations(
			workspaceId.trim(),
			_userId,
		);

		return json({
			success: true,
			recommendations,
		});
	} catch (error) {
		console.error("AI task recommendations failed:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}

			if (
				error.message.includes("Token refresh failed") ||
				error.message.includes("No refresh token")
			) {
				return json(
					{
						error:
							"Authentication tokens expired. Please re-authenticate with Notion.",
					},
					{ status: 401 },
				);
			}
		}

		return json(
			{ error: "Failed to get task recommendations" },
			{ status: 500 },
		);
	}
};
