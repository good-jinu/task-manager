// Re-export useful Notion SDK types and utilities
export {
	APIErrorCode,
	Client,
	ClientErrorCode,
	collectPaginatedAPI,
	isFullBlock,
	isFullPage,
	isFullUser,
	isNotionClientError,
	iteratePaginatedAPI,
	LogLevel,
} from "@notionhq/client";
export { NotionTaskClient } from "./client.js";
export { NotionTaskManager } from "./task-manager.js";
export type {
	CreateTaskInput,
	DatabaseConfig,
	Task,
	TaskFilter,
	UpdateTaskInput,
} from "./types.js";
export { TaskPriority, TaskStatus } from "./types.js";

// Import types for helper functions
import { Client } from "@notionhq/client";
import { NotionTaskManager } from "./task-manager.js";
import type { DatabaseConfig } from "./types.js";

// Helper functions for easier setup
export function createDatabaseConfig(databaseId: string): DatabaseConfig {
	return {
		databaseId,
		titleProperty: "Name",
		statusProperty: "Status",
		priorityProperty: "Priority",
		dueDateProperty: "Due Date",
		assigneeProperty: "Assignee",
		tagsProperty: "Tags",
		descriptionProperty: "Description",
	};
}

export function createTaskManager(
	token: string,
	config: DatabaseConfig,
): NotionTaskManager {
	const client = new Client({ auth: token });
	return new NotionTaskManager(client, config);
}
