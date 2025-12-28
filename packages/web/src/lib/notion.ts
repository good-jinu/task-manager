import {
	type CreateTaskInput,
	createDatabaseConfig,
	createTaskManager,
	type Task,
	type TaskFilter,
	TaskPriority,
	TaskStatus,
	type UpdateTaskInput,
} from "@notion-task-manager/notion";
import { env } from "$env/dynamic/private";

// Create the task manager instance
function getTaskManager() {
	if (!env.NOTION_TOKEN) {
		throw new Error("NOTION_TOKEN environment variable is required");
	}

	if (!env.NOTION_DATABASE_ID) {
		throw new Error("NOTION_DATABASE_ID environment variable is required");
	}

	const config = createDatabaseConfig(env.NOTION_DATABASE_ID);
	return createTaskManager(env.NOTION_TOKEN, config);
}

// Export task management functions for use in SvelteKit
export const taskService = {
	async createTask(input: CreateTaskInput): Promise<Task> {
		const manager = getTaskManager();
		return manager.createTask(input);
	},

	async getTasks(filter?: TaskFilter): Promise<Task[]> {
		const manager = getTaskManager();
		return manager.getTasks(filter);
	},

	async getTask(id: string): Promise<Task | null> {
		const manager = getTaskManager();
		return manager.getTask(id);
	},

	async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
		const manager = getTaskManager();
		return manager.updateTask(id, input);
	},

	async deleteTask(id: string): Promise<void> {
		const manager = getTaskManager();
		return manager.deleteTask(id);
	},
};

// Export types and enums for use in components
export {
	TaskStatus,
	TaskPriority,
	type Task,
	type CreateTaskInput,
	type UpdateTaskInput,
	type TaskFilter,
};
