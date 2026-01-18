import { generateText, stepCountIs } from "ai";
import { getModel } from "../llm/provider";
import type { Task, TaskService } from "../types";
import { createTaskExecutorFactory, type ExecutionStep } from "./tools";

/**
 * Parameters for task agent execution
 */
export interface TaskAgentExecuteParams {
	userId: string;
	executionId: string;
	workspaceId: string;
	query: string;
	contextTasks?: Task[];
	onStepComplete?: (step: ExecutionStep) => Promise<void>;
}

/**
 * Result of task agent execution
 */
export interface TaskAgentExecutionResult {
	action: "created" | "updated" | "queried" | "deleted" | "none";
	tasks?: Task[];
	taskId?: string;
	message: string;
	reasoning: string;
}

/**
 * TaskManagerAgent orchestrates internal task management using AI SDK tool calling
 */
export class TaskManagerAgent {
	private model = getModel();
	private taskService: TaskService;

	constructor({
		taskService,
	}: {
		taskService: TaskService;
	}) {
		this.taskService = taskService;
	}

	/**
	 * Execute the agent with the given parameters
	 */
	async execute(
		params: Omit<TaskAgentExecuteParams, "taskService">,
	): Promise<TaskAgentExecutionResult> {
		console.log("[TaskManagerAgent.execute] Starting execution:", {
			userId: params.userId,
			executionId: params.executionId,
			workspaceId: params.workspaceId,
			query: params.query,
			hasContextTasks: !!params.contextTasks,
			contextTasksCount: params.contextTasks?.length || 0,
		});

		const { workspaceId, query, onStepComplete } = params;

		// Track what actions were performed
		let lastAction: TaskAgentExecutionResult["action"] = "none";
		let lastTaskId: string | undefined;
		let lastTasks: Task[] = [];

		console.log("[TaskManagerAgent.execute] Initialized tracking variables");

		// Wrap onStepComplete to track actions
		const wrappedOnStepComplete = async (step: ExecutionStep) => {
			console.log("[TaskManagerAgent.wrappedOnStepComplete] Step completed:", {
				toolName: step.toolName,
				hasOutput: !!step.output,
				hasError: !!step.error,
			});

			// Track the action based on tool name and output
			if (step.toolName === "executeCreateTask" && step.output) {
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Create task detected",
				);
				lastAction = "created";
				const output = step.output as {
					taskId?: string;
					success?: boolean;
				};
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Create output:",
					output,
				);
				if (output.success && output.taskId) {
					lastTaskId = output.taskId;
					// Get the created task for the response
					try {
						console.log(
							"[TaskManagerAgent.wrappedOnStepComplete] Fetching created task:",
							output.taskId,
						);
						const task = await this.taskService.getTask(output.taskId);
						if (task) {
							lastTasks = [task];
							console.log(
								"[TaskManagerAgent.wrappedOnStepComplete] Created task fetched successfully",
							);
						}
					} catch (error) {
						console.error(
							"[TaskManagerAgent.wrappedOnStepComplete] Failed to fetch created task:",
							error,
						);
						// Ignore error, we'll use the output data
					}
				}
			} else if (step.toolName === "executeUpdateTask" && step.output) {
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Update task detected",
				);
				lastAction = "updated";
				const output = step.output as {
					taskId?: string;
					success?: boolean;
				};
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Update output:",
					output,
				);
				if (output.success && output.taskId) {
					lastTaskId = output.taskId;
					// Get the updated task for the response
					try {
						console.log(
							"[TaskManagerAgent.wrappedOnStepComplete] Fetching updated task:",
							output.taskId,
						);
						const task = await this.taskService.getTask(output.taskId);
						if (task) {
							lastTasks = [task];
							console.log(
								"[TaskManagerAgent.wrappedOnStepComplete] Updated task fetched successfully",
							);
						}
					} catch (error) {
						console.error(
							"[TaskManagerAgent.wrappedOnStepComplete] Failed to fetch updated task:",
							error,
						);
						// Ignore error, we'll use the output data
					}
				}
			} else if (step.toolName === "executeSearchTasks" && step.output) {
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Search tasks detected",
				);
				lastAction = "queried";
				const output = step.output as {
					tasks?: Task[];
					success?: boolean;
				};
				console.log("[TaskManagerAgent.wrappedOnStepComplete] Search output:", {
					success: output.success,
					taskCount: output.tasks?.length || 0,
				});
				if (output.success && output.tasks) {
					lastTasks = output.tasks;
				}
			} else if (step.toolName === "executeDeleteTask" && step.output) {
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Delete task detected",
				);
				lastAction = "deleted";
				const output = step.output as {
					taskId?: string;
					success?: boolean;
				};
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Delete output:",
					output,
				);
				if (output.success && output.taskId) {
					lastTaskId = output.taskId;
				}
			}

			console.log("[TaskManagerAgent.wrappedOnStepComplete] Current state:", {
				lastAction,
				lastTaskId,
				lastTasksCount: lastTasks.length,
			});

			// Call the original callback
			if (onStepComplete) {
				console.log(
					"[TaskManagerAgent.wrappedOnStepComplete] Calling original onStepComplete",
				);
				await onStepComplete(step);
			}
		};

		console.log("[TaskManagerAgent.execute] Creating task executor factory");
		const factory = createTaskExecutorFactory(
			this.taskService,
			workspaceId,
			wrappedOnStepComplete,
		);

		console.log(
			"[TaskManagerAgent.execute] Factory created, starting generateText",
		);
		try {
			const result = await generateText({
				model: this.model,
				toolChoice: "required",
				stopWhen: stepCountIs(10),
				tools: factory({
					search_tasks: true,
					create_task: true,
					update_task: true,
					get_task: true,
					delete_task: true,
				}),
				system: `You are a task management agent that helps users manage their internal tasks.
Your job is to process natural language task descriptions and perform the appropriate actions.

IMPORTANT RULES:
1. BEFORE creating or updating any task, call search_tasks with an ARRAY of relevant keywords extracted from the user's message.
2. Extract multiple search terms including: main topics, technologies, components, error types, etc.
3. If a similar task exists, decide whether to update it or create a new one based on the context.
4. When creating: Extract title, priority, due date, and content from the user's request.
5. When updating: Modify the existing task with new information.
6. When searching/querying: Use appropriate filters and search terms.
7. When deleting: Confirm the task exists before deletion.
8. Keep reasoning concise and actionable.

SEARCH EXAMPLES:
Example 1: User says "Create task for fixing Android UI crash"
- Call: search_tasks({query: ["android", "ui", "crash", "fix", "bug"]})

Example 2: User says "Update login task to include timeout handling"
- Call: search_tasks({query: ["login", "authentication", "timeout", "auth"]})

Example 3: User says "Find all high priority tasks"
- Call: search_tasks({query: [], priority: "high"})

When searching, use multiple relevant keywords from the user's request.
When creating, use a clear, actionable title and include relevant details.
When updating, preserve important information while adding new details.`,
				prompt: `Process this task management request:

"${query}"

Analyze the request and perform the appropriate action (search, create, update, or delete tasks).`,
			});

			console.log("[TaskManagerAgent.execute] generateText completed:", {
				hasText: !!result.text,
				textLength: result.text?.length || 0,
				toolCallsCount: result.toolCalls?.length || 0,
				stepsCount: result.steps?.length || 0,
			});

			// Determine the appropriate message based on the action
			let message = result.text || "Task processed successfully";
			console.log("[TaskManagerAgent.execute] Initial message:", message);

			const action = lastAction as TaskAgentExecutionResult["action"];
			console.log(
				"[TaskManagerAgent.execute] Determining message for action:",
				action,
			);

			switch (action) {
				case "created":
					if (lastTasks.length > 0) {
						message = `Created task: "${lastTasks[0].title}"`;
						console.log(
							"[TaskManagerAgent.execute] Created task message:",
							message,
						);
					}
					break;
				case "updated":
					if (lastTasks.length > 0) {
						message = `Updated task: "${lastTasks[0].title}"`;
						console.log(
							"[TaskManagerAgent.execute] Updated task message:",
							message,
						);
					}
					break;
				case "queried":
					message =
						lastTasks.length > 0
							? `Found ${lastTasks.length} task${lastTasks.length > 1 ? "s" : ""}`
							: "No tasks found matching your criteria";
					console.log(
						"[TaskManagerAgent.execute] Queried tasks message:",
						message,
					);
					break;
				case "deleted":
					message = "Task deleted successfully";
					console.log(
						"[TaskManagerAgent.execute] Deleted task message:",
						message,
					);
					break;
				default:
					console.log(
						"[TaskManagerAgent.execute] No specific action, keeping default message",
					);
					break;
			}

			const finalResult = {
				action: lastAction,
				tasks: lastTasks.length > 0 ? lastTasks : undefined,
				taskId: lastTaskId,
				message,
				reasoning: result.text || "Task processed successfully",
			};

			console.log(
				"[TaskManagerAgent.execute] Execution completed successfully:",
				{
					action: finalResult.action,
					hasTaskId: !!finalResult.taskId,
					tasksCount: finalResult.tasks?.length || 0,
					message: finalResult.message,
				},
			);

			return finalResult;
		} catch (error) {
			console.error("[TaskManagerAgent.execute] Execution failed:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";

			const errorResult = {
				action: "none" as const,
				message: `Failed to process task: ${errorMessage}`,
				reasoning: `Failed to process task: ${errorMessage}`,
			};

			console.log(
				"[TaskManagerAgent.execute] Returning error result:",
				errorResult,
			);
			return errorResult;
		}
	}
}
