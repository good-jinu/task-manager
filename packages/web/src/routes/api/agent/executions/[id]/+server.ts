import { AgentExecutionService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const session = await requireAuth(event);

		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		const executionId = event.params.id;

		if (!executionId || !executionId.trim()) {
			return json({ error: "Execution ID is required" }, { status: 400 });
		}

		// Get execution by ID
		const executionService = new AgentExecutionService();
		const execution = await executionService.getExecutionById(
			user.id,
			executionId,
		);

		if (!execution) {
			return json({ error: "Execution not found" }, { status: 404 });
		}

		return json({
			execution,
		});
	} catch (error) {
		console.error("Failed to get agent execution:", error);

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
