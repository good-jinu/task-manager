import { json } from "@sveltejs/kit";
import { AgentExecutionService } from "@task-manager/db";
import { TaskQueueService } from "@task-manager/queue";
import { requireAuthOrGuest } from "$lib/auth/middleware";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	console.log("[API /api/agent/execute-task] Request received");
	try {
		// Use centralized auth middleware
		console.log("[API /api/agent/execute-task] Calling requireAuthOrGuest");
		const { userId, isGuest } = await requireAuthOrGuest(event);
		console.log("[API /api/agent/execute-task] Auth successful:", {
			userId,
			isGuest,
		});

		const requestBody = await event.request.json();
		const { query, workspaceId, contextTasks = [] } = requestBody;

		console.log("[API /api/agent/execute-task] Execute task API called with:", {
			userId,
			workspaceId,
			query,
			contextTasksCount: contextTasks.length,
		});

		// Validate required fields
		if (!query || typeof query !== "string" || !query.trim()) {
			console.error("[API /api/agent/execute-task] Invalid query");
			return json(
				{ error: "Query is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		if (
			!workspaceId ||
			typeof workspaceId !== "string" ||
			!workspaceId.trim()
		) {
			console.error("[API /api/agent/execute-task] Invalid workspaceId");
			return json(
				{ error: "Workspace ID is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Create execution record
		const executionService = new AgentExecutionService();

		console.log("[API /api/agent/execute-task] Creating execution record");
		const executionRecord = await executionService.createExecution(userId, {
			query: query.trim(),
			databaseId: workspaceId, // Use workspaceId as databaseId for internal tasks
		});

		const executionId = executionRecord.executionId;
		console.log(
			"[API /api/agent/execute-task] Execution record created:",
			executionId,
		);

		// Send message to SQS queue for async processing
		console.log("[API /api/agent/execute-task] Sending message to queue");
		const queueService = new TaskQueueService();
		const queueResult = await queueService.sendTaskExecution({
			userId,
			executionId,
			workspaceId,
			query: query.trim(),
			contextTasks,
		});

		if (!queueResult.success) {
			console.error(
				"[API /api/agent/execute-task] Failed to send to queue:",
				queueResult.error,
			);
			// Update execution status to failed
			await executionService.updateExecutionStatus(
				userId,
				executionId,
				"fail",
				{
					error: `Failed to queue task: ${queueResult.error}`,
				},
			);
			return json(
				{
					success: false,
					error: "Failed to queue task for processing",
				},
				{ status: 500 },
			);
		}

		console.log("[API /api/agent/execute-task] Message queued successfully:", {
			messageId: queueResult.messageId,
		});

		// Return immediately with executionId
		console.log("[API /api/agent/execute-task] Returning success response");
		return json({
			success: true,
			executionId,
			status: "pending",
		});
	} catch (error) {
		console.error(
			"[API /api/agent/execute-task] Failed to create task execution:",
			error,
		);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 },
		);
	}
};
