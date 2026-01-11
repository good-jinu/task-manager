import type { Tool } from "ai";
import type { ExecutionStep, TaskService } from "../../types";
import {
	type CreateTaskInput,
	createTaskInputSchema,
	executeCreateTask,
} from "./create-task";
import {
	type DeleteTaskInput,
	deleteTaskInputSchema,
	executeDeleteTask,
} from "./delete-task";
import {
	executeGetTask,
	type GetTaskInput,
	getTaskInputSchema,
} from "./get-task";
import {
	executeSearchTasks,
	type SearchTasksInput,
	searchTasksInputSchema,
} from "./search-tasks";
import {
	executeUpdateTask,
	type UpdateTaskInput,
	updateTaskInputSchema,
} from "./update-task";

/**
 * Tool common arguments for task operations
 */
export interface TaskToolCommonArgs {
	workspaceId: string;
	taskService: TaskService;
}

/**
 * Factory function to create AI SDK tools configuration for task management
 */
export function createTaskExecutorFactory(
	taskService: TaskService,
	workspaceId: string,
	onStepComplete?: (step: ExecutionStep) => Promise<void>,
) {
	const toolCommonArgs: TaskToolCommonArgs = {
		workspaceId,
		taskService,
	};

	async function funcWrapper<I>(params: {
		func: (input: TaskToolCommonArgs & I) => Promise<unknown>;
	}) {
		return async (input: I) => {
			const mergedInput = { ...toolCommonArgs, ...input };

			// Helper function to safely serialize objects for storage
			const safeSerialize = (obj: unknown): Record<string, unknown> => {
				try {
					return JSON.parse(JSON.stringify(obj));
				} catch {
					return { serialized: String(obj) };
				}
			};

			try {
				const output = await params.func(mergedInput);
				onStepComplete?.({
					stepId: crypto.randomUUID(),
					toolName: params.func.name,
					input: safeSerialize(input),
					output: safeSerialize(output),
					timestamp: new Date().toISOString(),
				});
				return output;
			} catch (error) {
				onStepComplete?.({
					stepId: crypto.randomUUID(),
					toolName: params.func.name,
					input: safeSerialize(input),
					error: (error as Error).message,
					timestamp: new Date().toISOString(),
				});
				throw error;
			}
		};
	}

	return (toolsConfig: {
		search_tasks?: boolean;
		create_task?: boolean;
		update_task?: boolean;
		get_task?: boolean;
		delete_task?: boolean;
	}) => {
		const tools: Record<string, Tool> = {};

		if (toolsConfig.search_tasks) {
			tools.search_tasks = {
				description:
					"Search for existing tasks in the workspace that match the query. Use this to find tasks before creating or updating them.",
				inputSchema: searchTasksInputSchema,
				execute: async (input: SearchTasksInput) => {
					const wrapper = await funcWrapper({
						func: executeSearchTasks,
					});
					return await wrapper({ input });
				},
			};
		}

		if (toolsConfig.create_task) {
			tools.create_task = {
				description:
					"Create a new task in the workspace. Use this when no similar existing task is found.",
				inputSchema: createTaskInputSchema,
				execute: async (input: CreateTaskInput) => {
					const wrapper = await funcWrapper({
						func: executeCreateTask,
					});
					return await wrapper({ input });
				},
			};
		}

		if (toolsConfig.update_task) {
			tools.update_task = {
				description:
					"Update an existing task. Use this when you have found a task that needs to be modified.",
				inputSchema: updateTaskInputSchema,
				execute: async (input: UpdateTaskInput) => {
					const wrapper = await funcWrapper({
						func: executeUpdateTask,
					});
					return await wrapper({ input });
				},
			};
		}

		if (toolsConfig.get_task) {
			tools.get_task = {
				description:
					"Get detailed information about a specific task by its ID.",
				inputSchema: getTaskInputSchema,
				execute: async (input: GetTaskInput) => {
					const wrapper = await funcWrapper({
						func: executeGetTask,
					});
					return await wrapper({ input });
				},
			};
		}

		if (toolsConfig.delete_task) {
			tools.delete_task = {
				description:
					"Delete a task from the workspace. Use this when a task needs to be permanently removed.",
				inputSchema: deleteTaskInputSchema,
				execute: async (input: DeleteTaskInput) => {
					const wrapper = await funcWrapper({
						func: executeDeleteTask,
					});
					return await wrapper({ input });
				},
			};
		}

		return tools;
	};
}
