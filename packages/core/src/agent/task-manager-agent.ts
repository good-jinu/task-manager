import type { Task, TaskService } from "@notion-task-manager/db";
import { generateText, stepCountIs } from "ai";
import { getModel } from "../llm/provider";
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
	taskService: TaskService;
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

	/**
	 * Execute the agent with the given parameters
	 */
	async execute(
		params: TaskAgentExecuteParams,
	): Promise<TaskAgentExecutionResult> {
		const { workspaceId, query, taskService, onStepComplete } = params;

		// Track what actions were performed
		let lastAction: TaskAgentExecutionResult["action"] = "none";
		let lastTaskId: string | undefined;
		let lastTasks: Task[] = [];

		// Wrap onStepComplete to track actions
		const wrappedOnStepComplete = async (step: ExecutionStep) => {
			// Track the action based on tool name and output
			if (step.toolName === "executeCreateTask" && step.output) {
				lastAction = "created";
				const output = step.output as {
					taskId?: string;
					success?: boolean;
				};
				if (output.success && output.taskId) {
					lastTaskId = output.taskId;
					// Get the created task for the response
					try {
						const task = await taskService.getTask(output.taskId);
						if (task) {
							lastTasks = [task];
						}
					} catch {
						// Ignore error, we'll use the output data
					}
				}
			} else if (step.toolName === "executeUpdateTask" && step.output) {
				lastAction = "updated";
				const output = step.output as {
					taskId?: string;
					success?: boolean;
				};
				if (output.success && output.taskId) {
					lastTaskId = output.taskId;
					// Get the updated task for the response
					try {
						const task = await taskService.getTask(output.taskId);
						if (task) {
							lastTasks = [task];
						}
					} catch {
						// Ignore error, we'll use the output data
					}
				}
			} else if (step.toolName === "executeSearchTasks" && step.output) {
				lastAction = "queried";
				const output = step.output as {
					tasks?: Task[];
					success?: boolean;
				};
				if (output.success && output.tasks) {
					lastTasks = output.tasks;
				}
			} else if (step.toolName === "executeDeleteTask" && step.output) {
				lastAction = "deleted";
				const output = step.output as {
					taskId?: string;
					success?: boolean;
				};
				if (output.success && output.taskId) {
					lastTaskId = output.taskId;
				}
			}

			// Call the original callback
			if (onStepComplete) {
				await onStepComplete(step);
			}
		};

		const factory = createTaskExecutorFactory(
			taskService,
			workspaceId,
			wrappedOnStepComplete,
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

			// Determine the appropriate message based on the action
			let message = result.text || "Task processed successfully";

			const action = lastAction as TaskAgentExecutionResult["action"];
			switch (action) {
				case "created":
					if (lastTasks.length > 0) {
						message = `Created task: "${lastTasks[0].title}"`;
					}
					break;
				case "updated":
					if (lastTasks.length > 0) {
						message = `Updated task: "${lastTasks[0].title}"`;
					}
					break;
				case "queried":
					message =
						lastTasks.length > 0
							? `Found ${lastTasks.length} task${lastTasks.length > 1 ? "s" : ""}`
							: "No tasks found matching your criteria";
					break;
				case "deleted":
					message = "Task deleted successfully";
					break;
				default:
					// Keep the default message
					break;
			}

			return {
				action: lastAction,
				tasks: lastTasks.length > 0 ? lastTasks : undefined,
				taskId: lastTaskId,
				message,
				reasoning: result.text || "Task processed successfully",
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				action: "none",
				message: `Failed to process task: ${errorMessage}`,
				reasoning: `Failed to process task: ${errorMessage}`,
			};
		}
	}
}
