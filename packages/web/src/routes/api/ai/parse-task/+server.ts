import { createAIAgentService } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		await requireAuth(event);

		const requestBody = await event.request.json();
		const { input } = requestBody;

		// Validate required fields
		if (!input || typeof input !== "string" || !input.trim()) {
			return json(
				{ error: "Input is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Create AI agent service
		const aiService = createAIAgentService();

		// Parse the natural language input
		const parsedTask = await aiService.parseNaturalLanguageTask(input.trim());

		return json({
			success: true,
			parsedTask,
		});
	} catch (error) {
		console.error("AI task parsing failed:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}
		}

		return json({ error: "Failed to parse task" }, { status: 500 });
	}
};
