import type { ExecutionStep } from "@task-manager/core";
import { TaskManagerAgent } from "@task-manager/core";
import {
	AgentExecutionService,
	createNotionTaskManagerWithAuth,
	NotionAdapter,
	TaskIntegrationService,
	TaskService,
	UserService,
	WorkspaceIntegrationService,
} from "@task-manager/db";
import type { TaskExecutionMessage } from "@task-manager/queue";
import type { SQSEvent, SQSHandler } from "aws-lambda";

/**
 * SQS Worker Lambda Handler
 * Processes task execution messages from the queue
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
	console.log("[TaskProcessor] Processing batch:", {
		recordCount: event.Records.length,
	});

	// Process each message in the batch
	for (const record of event.Records) {
		try {
			console.log("[TaskProcessor] Processing message:", {
				messageId: record.messageId,
			});

			const message: TaskExecutionMessage = JSON.parse(record.body);

			console.log("[TaskProcessor] Message parsed:", {
				userId: message.userId,
				executionId: message.executionId,
				workspaceId: message.workspaceId,
				query: message.query,
				contextTasksCount: message.contextTasks.length,
			});

			await processTaskExecution(message);

			console.log("[TaskProcessor] Message processed successfully:", {
				messageId: record.messageId,
				executionId: message.executionId,
			});
		} catch (error) {
			console.error("[TaskProcessor] Failed to process message:", {
				messageId: record.messageId,
				error,
			});
			// SQS will retry the message based on queue configuration
			throw error;
		}
	}
};

/**
 * Process a single task execution message
 */
async function processTaskExecution(
	message: TaskExecutionMessage,
): Promise<void> {
	const { userId, executionId, workspaceId, query, contextTasks } = message;

	const executionService = new AgentExecutionService();
	const taskService = new TaskService();
	const workspaceIntegrationService = new WorkspaceIntegrationService();
	const taskIntegrationService = new TaskIntegrationService();
	const userService = new UserService();

	console.log("[processTaskExecution] Starting processing:", {
		userId,
		executionId,
		workspaceId,
		query,
		contextTasksCount: contextTasks.length,
	});

	// Check if Notion integration is enabled for this workspace
	let notionIntegration: Awaited<
		ReturnType<typeof workspaceIntegrationService.findByWorkspaceAndProvider>
	> | null = null;
	let notionAdapter: NotionAdapter | null = null;

	try {
		console.log(
			"[processTaskExecution] Checking for Notion integration:",
			workspaceId,
		);
		notionIntegration =
			await workspaceIntegrationService.findByWorkspaceAndProvider(
				workspaceId,
				"notion",
			);

		if (notionIntegration?.syncEnabled) {
			console.log(
				"[processTaskExecution] Notion integration found and enabled:",
				{
					integrationId: notionIntegration.id,
					databaseId: notionIntegration.config.databaseId,
				},
			);

			// Get user to create Notion client
			const user = await userService.getUserById(userId);
			if (user) {
				// Get OAuth credentials from environment
				const clientId = process.env.AUTH_NOTION_ID;
				const clientSecret = process.env.AUTH_NOTION_SECRET;

				if (!clientId || !clientSecret) {
					console.error(
						"[processTaskExecution] Notion OAuth credentials not configured",
					);
				} else {
					const notionTaskManager = createNotionTaskManagerWithAuth(
						user,
						clientId,
						clientSecret,
					);
					notionAdapter = new NotionAdapter(notionTaskManager);
					console.log("[processTaskExecution] Notion adapter initialized");
				}
			} else {
				console.warn(
					"[processTaskExecution] User not found, skipping Notion sync",
				);
			}
		} else {
			console.log(
				"[processTaskExecution] Notion integration not enabled for workspace",
			);
		}
	} catch (error) {
		console.error(
			"[processTaskExecution] Failed to check Notion integration:",
			error,
		);
		// Continue without Notion sync
	}

	try {
		console.log("[processTaskExecution] Creating TaskManagerAgent");
		const agent = new TaskManagerAgent({ taskService });

		console.log("[processTaskExecution] Executing agent");
		const result = await agent.execute({
			userId,
			executionId,
			workspaceId,
			query,
			contextTasks,
			onStepComplete: async (step: ExecutionStep) => {
				console.log("[processTaskExecution] Agent step completed:", {
					toolName: step.toolName,
					workspaceId,
				});

				// Record each step as it completes
				try {
					await executionService.addExecutionStep(userId, executionId, step);
				} catch (stepError) {
					console.error(
						"[processTaskExecution] Failed to add execution step:",
						stepError,
					);
					// Don't fail the entire execution if step recording fails
				}

				// Sync to Notion if integration is enabled
				if (notionAdapter && notionIntegration) {
					try {
						await syncStepToNotion(
							step,
							notionAdapter,
							notionIntegration,
							taskService,
							taskIntegrationService,
						);
					} catch (notionError) {
						console.error(
							"[processTaskExecution] Failed to sync to Notion:",
							notionError,
						);
						// Don't fail the entire execution if Notion sync fails
					}
				}
			},
		});

		console.log("[processTaskExecution] Agent execution completed:", {
			action: result.action,
			taskId: result.taskId,
			workspaceId,
		});

		// Update execution record with success
		const mappedAction =
			result.action === "queried" || result.action === "deleted"
				? "none"
				: result.action;

		console.log("[processTaskExecution] Updating execution status to done");
		await executionService.updateExecutionStatus(userId, executionId, "done", {
			result: {
				action: mappedAction,
				reasoning: result.reasoning,
			},
		});
		console.log("[processTaskExecution] Execution status updated successfully");
	} catch (error) {
		console.error("[processTaskExecution] Task agent execution failed:", error);

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Update execution status with error
		try {
			console.log("[processTaskExecution] Updating execution status to fail");
			await executionService.updateExecutionStatus(
				userId,
				executionId,
				"fail",
				{
					error: errorMessage,
				},
			);
			console.log("[processTaskExecution] Error status updated successfully");
		} catch (updateError) {
			console.error(
				"[processTaskExecution] Failed to update execution status with error:",
				updateError,
			);
		}

		// Re-throw to trigger SQS retry
		throw error;
	}
}

/**
 * Sync agent step to Notion if applicable
 */
async function syncStepToNotion(
	step: ExecutionStep,
	notionAdapter: NotionAdapter,
	notionIntegration: NonNullable<
		Awaited<
			ReturnType<
				typeof WorkspaceIntegrationService.prototype.findByWorkspaceAndProvider
			>
		>
	>,
	taskService: TaskService,
	taskIntegrationService: TaskIntegrationService,
): Promise<void> {
	const databaseId = notionIntegration.config.databaseId as string | undefined;
	if (!databaseId) {
		console.log("[syncStepToNotion] No database ID configured, skipping sync");
		return;
	}

	// Handle task creation
	if (step.toolName === "executeCreateTask" && step.output) {
		const output = step.output as {
			success?: boolean;
			taskId?: string;
			title?: string;
		};

		if (output.success && output.taskId) {
			console.log("[syncStepToNotion] Syncing created task to Notion:", {
				taskId: output.taskId,
				databaseId,
			});

			try {
				// Get the full task details
				const task = await taskService.getTask(output.taskId);
				if (!task) {
					console.warn("[syncStepToNotion] Task not found:", output.taskId);
					return;
				}

				// Create page in Notion
				console.log("[syncStepToNotion] Creating Notion page:", {
					title: task.title,
					hasContent: !!task.content,
				});
				const notionPage = await notionAdapter.createTask(databaseId, {
					title: task.title,
					content: task.content,
				});

				console.log("[syncStepToNotion] Notion page created:", {
					notionPageId: notionPage.id,
					taskId: task.id,
				});

				// Create task integration mapping
				await taskIntegrationService.create(task.id, {
					provider: "notion",
					externalId: notionPage.id,
				});

				console.log("[syncStepToNotion] Task integration created successfully");
			} catch (error) {
				console.error(
					"[syncStepToNotion] Failed to sync task to Notion:",
					error,
				);
				throw error;
			}
		}
	}

	// Handle task updates
	if (step.toolName === "executeUpdateTask" && step.output) {
		const output = step.output as {
			success?: boolean;
			taskId?: string;
		};

		if (output.success && output.taskId) {
			console.log("[syncStepToNotion] Syncing updated task to Notion:", {
				taskId: output.taskId,
			});

			try {
				// Check if task has Notion integration
				const integration = await taskIntegrationService.getByTaskId(
					output.taskId,
				);

				if (integration && integration.provider === "notion") {
					console.log("[syncStepToNotion] Task has Notion integration:", {
						notionPageId: integration.externalId,
					});

					// Get the full task details
					const task = await taskService.getTask(output.taskId);
					if (!task) {
						console.warn("[syncStepToNotion] Task not found:", output.taskId);
						return;
					}

					// Update Notion page with new content
					console.log("[syncStepToNotion] Updating Notion page:", {
						notionPageId: integration.externalId,
						title: task.title,
						hasContent: !!task.content,
					});

					await notionAdapter.updateTask(integration.externalId, {
						title: task.title,
						content: task.content || "",
					});

					console.log("[syncStepToNotion] Notion page updated successfully");
				} else {
					console.log(
						"[syncStepToNotion] Task not linked to Notion, skipping update",
					);
				}
			} catch (error) {
				console.error(
					"[syncStepToNotion] Failed to sync update to Notion:",
					error,
				);
				throw error;
			}
		}
	}

	// Note: We don't sync search/query operations or deletes to Notion
}
