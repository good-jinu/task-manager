import { json } from "@sveltejs/kit";
import type { ExecutionStep } from "@task-manager/core";
import { TaskManagerAgent } from "@task-manager/core";
import {
	AgentExecutionService,
	type Task,
	TaskService,
} from "@task-manager/db";
import { requireAuthOrGuest } from "$lib/auth/middleware";
import type { RequestHandler } from "./$types";

// Async function to process the task execution in the background
async function processTaskExecution(
	userId: string,
	executionId: string,
	workspaceId: string,
	query: string,
	contextTasks: Task[],
) {
	const executionService = new AgentExecutionService();
	const taskService = new TaskService();

	console.log("Background processing started:", {
		userId,
		executionId,
		workspaceId,
		query,
	});

	try {
		const agent = new TaskManagerAgent({ taskService });

		const result = await agent.execute({
			userId,
			executionId,
			workspaceId,
			query,
			contextTasks,
			onStepComplete: async (step: ExecutionStep) => {
				console.log("Agent step completed:", {
					toolName: step.toolName,
					workspaceId,
				});
				// Record each step as it completes
				try {
					await executionService.addExecutionStep(userId, executionId, step);
				} catch (stepError) {
					console.error("Failed to add execution step:", stepError);
					// Don't fail the entire execution if step recording fails
				}
			},
		});

		console.log("Agent execution completed:", {
			action: result.action,
			taskId: result.taskId,
			workspaceId,
		});

		// Update execution record with success
		const mappedAction =
			result.action === "queried" || result.action === "deleted"
				? "none"
				: result.action;

		await executionService.updateExecutionStatus(userId, executionId, "done", {
			result: {
				action: mappedAction,
				reasoning: result.reasoning,
			},
		});
	} catch (error) {
		console.error("Task agent execution failed:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Update execution status with error
		try {
			await executionService.updateExecutionStatus(
				userId,
				executionId,
				"fail",
				{
					error: errorMessage,
				},
			);
		} catch (updateError) {
			console.error(
				"Failed to update execution status with error:",
				updateError,
			);
		}
	}
}

export const POST: RequestHandler = async (event) => {
	try {
		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const requestBody = await event.request.json();
		const { query, workspaceId, contextTasks = [] } = requestBody;

		console.log("Execute task API called with:", {
			userId,
			workspaceId,
			query,
			contextTasksCount: contextTasks.length,
		});

		// Validate required fields
		if (!query || typeof query !== "string" || !query.trim()) {
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
			return json(
				{ error: "Workspace ID is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		// Create execution record
		const executionService = new AgentExecutionService();

		const executionRecord = await executionService.createExecution(userId, {
			query: query.trim(),
			databaseId: workspaceId, // Use workspaceId as databaseId for internal tasks
		});

		const executionId = executionRecord.executionId;

		// Start async processing (don't await)
		processTaskExecution(
			userId,
			executionId,
			workspaceId,
			query.trim(),
			contextTasks,
		).catch((error) => {
			console.error("Background task execution failed:", error);
		});

		// Return immediately with executionId
		return json({
			success: true,
			executionId,
			status: "pending",
		});
	} catch (error) {
		console.error("Failed to create task execution:", error);

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
