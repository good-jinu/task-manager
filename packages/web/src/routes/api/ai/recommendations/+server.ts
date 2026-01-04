import { createAIAgentService } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get user data from database
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
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
			user.id,
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
