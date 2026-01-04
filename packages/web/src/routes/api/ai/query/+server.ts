import { createAIAgentService } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		await requireAuth(event);

		const requestBody = await event.request.json();
		const { workspaceId, query } = requestBody;

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

		if (!query || typeof query !== "string" || !query.trim()) {
			return json(
				{ error: "Query is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Create AI agent service
		const aiService = createAIAgentService();

		// Query tasks using natural language
		const tasks = await aiService.queryTasks(workspaceId.trim(), query.trim());

		return json({
			success: true,
			tasks,
			query: query.trim(),
		});
	} catch (error) {
		console.error("AI task query failed:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}
		}

		return json({ error: "Failed to query tasks" }, { status: 500 });
	}
};
