import { TaskManagerAgent } from "@notion-task-manager/core";
import type { ExecutionStep } from "@notion-task-manager/db";
import { AgentExecutionService, TaskService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	let executionId: string | undefined;
	let userId: string | undefined;

	try {
		// Check if user is authenticated or guest
		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			userId = guestId;
		}

		const requestBody = await event.request.json();
		const { query, workspaceId, contextTasks = [] } = requestBody;

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

		executionId = executionRecord.executionId;

		// Process the task execution
		const taskService = new TaskService();
		const agent = new TaskManagerAgent();

		const steps: ExecutionStep[] = [];

		const result = await agent.execute({
			userId,
			executionId,
			workspaceId,
			query: query.trim(),
			contextTasks,
			taskService,
			onStepComplete: async (step: ExecutionStep) => {
				steps.push(step);
				// Record each step as it completes
				try {
					if (executionId && userId) {
						await executionService.addExecutionStep(userId, executionId, step);
					}
				} catch (stepError) {
					console.error("Failed to add execution step:", stepError);
					// Don't fail the entire execution if step recording fails
				}
			},
		});

		// Update execution record with success
		const mappedAction =
			result.action === "queried" || result.action === "deleted"
				? "none"
				: result.action;
		try {
			await executionService.updateExecutionStatus(
				userId,
				executionId,
				"done",
				{
					result: {
						action: mappedAction,
						reasoning: result.reasoning,
					},
				},
			);
		} catch (updateError) {
			console.error("Failed to update execution status:", updateError);
			// Don't fail the entire request if status update fails
		}

		// Get updated tasks for the workspace
		const tasksResult = await taskService.listTasks(workspaceId);
		const tasks = tasksResult.items;

		return json({
			success: true,
			executionId,
			result: {
				action: result.action,
				message: result.message,
				tasks: tasks,
			},
		});
	} catch (error) {
		console.error("Task agent execution failed:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Try to update execution status with error if we have the executionId and it was created
		try {
			if (executionId && userId) {
				const executionService = new AgentExecutionService();
				await executionService.updateExecutionStatus(
					userId,
					executionId,
					"fail",
					{
						error: errorMessage,
					},
				);
			}
		} catch (updateError) {
			console.error(
				"Failed to update execution status with error:",
				updateError,
			);
		}

		return json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 },
		);
	}
};
