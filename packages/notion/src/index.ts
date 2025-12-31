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
export type { NotionAuthConfig, TokenRefreshCallback } from "./auth-client";
export { NotionAuthClient } from "./auth-client";
export { NotionTaskManager } from "./task-manager";
export type {
	DatabaseConfig,
	NotionDatabase,
	NotionPage,
	PageProperties,
} from "./types";
export {
	extractProperties,
	extractPropertyText,
	formatPageForAI,
	formatPagesForAI,
} from "./utils";

// Import types for helper functions
import { Client } from "@notionhq/client";
import { NotionTaskManager } from "./task-manager";

// Helper functions for easier setup
export function createTaskManager(token: string): NotionTaskManager {
	const client = new Client({ auth: token });
	return new NotionTaskManager(client);
}
