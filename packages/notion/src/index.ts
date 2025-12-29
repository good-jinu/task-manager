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

export { NotionTaskManager } from "./task-manager.js";
export type {
	DatabaseConfig,
	NotionDatabase,
	NotionPage,
} from "./types.js";

// Import types for helper functions
import { Client } from "@notionhq/client";
import { NotionTaskManager } from "./task-manager.js";

// Helper functions for easier setup
export function createTaskManager(token: string): NotionTaskManager {
	const client = new Client({ auth: token });
	return new NotionTaskManager(client);
}
