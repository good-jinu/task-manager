import { json } from "@sveltejs/kit";
import { AgentExecutionService } from "@task-manager/db";
import { requireAuthOrGuest } from "$lib/auth/middleware";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const executionId = event.params.id;

		if (!executionId) {
			return json({ error: "Execution ID is required" }, { status: 400 });
		}

		const executionService = new AgentExecutionService();
		const execution = await executionService.getExecutionById(
			userId,
			executionId,
		);

		if (!execution) {
			return json({ error: "Execution not found" }, { status: 404 });
		}

		return json({
			success: true,
			execution,
		});
	} catch (error) {
		console.error("Failed to fetch execution:", error);

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
