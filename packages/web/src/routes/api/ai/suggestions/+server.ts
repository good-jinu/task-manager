import { createAIAgentService } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		await requireAuth(event);

		const requestBody = await event.request.json();
		const { workspaceId, context } = requestBody;

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

		// Validate optional context
		if (context !== undefined && typeof context !== "string") {
			return json(
				{ error: "Context must be a string if provided" },
				{ status: 400 },
			);
		}

		// Create AI agent service
		const aiService = createAIAgentService();

		// Generate task suggestions
		const suggestions = await aiService.generateTaskSuggestions(
			workspaceId.trim(),
			context?.trim(),
		);

		return json({
			success: true,
			suggestions,
		});
	} catch (error) {
		console.error("AI task suggestions failed:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}
		}

		return json(
			{ error: "Failed to generate task suggestions" },
			{ status: 500 },
		);
	}
};
