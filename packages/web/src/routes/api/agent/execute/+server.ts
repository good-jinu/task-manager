import { AgentExecutionService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";
import { processAgentExecutionInBackground } from "./processor";

export const POST: RequestHandler = async (event) => {
	try {
		const session = await requireAuth(event);

		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		const requestBody = await event.request.json();
		const { query, databaseId } = requestBody;

		// Validate required fields
		if (!query || typeof query !== "string" || !query.trim()) {
			return json(
				{ error: "Query is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		if (!databaseId || typeof databaseId !== "string" || !databaseId.trim()) {
			return json(
				{ error: "Database ID is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Create pending execution record
		const executionService = new AgentExecutionService();
		const executionRecord = await executionService.createExecution(user.id, {
			query: query.trim(),
			databaseId: databaseId.trim(),
		});

		// Trigger background agent processing (non-blocking)
		processAgentExecutionInBackground(user, executionRecord.executionId, {
			query: query.trim(),
			databaseId: databaseId.trim(),
		});

		// Return immediately with executionId and pending status
		return json({
			success: true,
			executionId: executionRecord.executionId,
			status: "pending",
		});
	} catch (error) {
		console.error("Agent execution submission failed:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
