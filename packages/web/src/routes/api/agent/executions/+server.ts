import { json } from "@sveltejs/kit";
import { AgentExecutionService } from "@task-manager/db";
import { requireAuthOrGuest } from "$lib/auth/middleware";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const executionService = new AgentExecutionService();
		const executions = await executionService.getUserExecutions(userId);

		return json({
			success: true,
			executions,
		});
	} catch (error) {
		console.error("Failed to fetch executions:", error);

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
