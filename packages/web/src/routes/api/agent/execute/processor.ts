import { TaskManagerAgent } from "@notion-task-manager/core";
import type { ExecutionStep, User } from "@notion-task-manager/db";
import { AgentExecutionService } from "@notion-task-manager/db";
import { createNotionTaskManagerWithAuth } from "$lib/notion";

interface AgentExecutionInput {
	query: string;
	databaseId: string;
}

/**
 * Process agent execution in background without blocking the response.
 * Updates the execution record with results on success or error on failure.
 */
export function processAgentExecutionInBackground(
	user: User,
	executionId: string,
	input: AgentExecutionInput,
): void {
	// Execute agent asynchronously without awaiting
	executeAgent(user, executionId, input).catch((error) => {
		console.error(
			`Background agent execution failed for executionId ${executionId}:`,
			error,
		);
	});
}

async function executeAgent(
	user: User,
	executionId: string,
	input: AgentExecutionInput,
): Promise<void> {
	const executionService = new AgentExecutionService();

	try {
		// Create Notion client and TaskManagerAgent
		const notionManager = createNotionTaskManagerWithAuth(user);
		const agent = new TaskManagerAgent();

		// Execute agent with step recording callback
		const result = await agent.execute({
			userId: user.id,
			executionId,
			query: input.query,
			databaseId: input.databaseId,
			notionManager,
			onStepComplete: async (step: ExecutionStep) => {
				// Record each step as it completes
				await executionService.addExecutionStep(user.id, executionId, step);
			},
		});

		// Update execution record with success
		await executionService.updateExecutionStatus(user.id, executionId, "done", {
			result,
		});
	} catch (error) {
		// Update execution record with failure
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		await executionService.updateExecutionStatus(user.id, executionId, "fail", {
			error: errorMessage,
		});
	}
}
