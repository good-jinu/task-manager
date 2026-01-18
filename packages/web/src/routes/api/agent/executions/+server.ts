import { json } from "@sveltejs/kit";
import { AgentExecutionService } from "@task-manager/db";
import { requireAuthOrGuest } from "$lib/auth/middleware";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	console.log("[API /api/agent/executions] Request received");
	console.log("[API /api/agent/executions] Headers:", {
		"x-guest-id": event.request.headers.get("x-guest-id"),
		cookie: `${event.request.headers.get("cookie")?.substring(0, 100)}...`,
	});
	console.log("[API /api/agent/executions] Cookies:", {
		"guest-id": event.cookies.get("guest-id"),
	});

	try {
		// Use centralized auth middleware
		console.log("[API /api/agent/executions] Calling requireAuthOrGuest");
		const { userId, isGuest } = await requireAuthOrGuest(event);
		console.log("[API /api/agent/executions] Auth successful:", {
			userId,
			isGuest,
		});

		const executionService = new AgentExecutionService();
		const executions = await executionService.getUserExecutions(userId);
		console.log(
			"[API /api/agent/executions] Found executions:",
			executions.length,
		);

		return json({
			success: true,
			executions,
		});
	} catch (error) {
		console.error("[API /api/agent/executions] Error:", error);

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
