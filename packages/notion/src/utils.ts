import { NotionTaskClient } from "./client.js";
import { NotionTaskManager } from "./task-manager.js";
import type { DatabaseConfig } from "./types.js";

/**
 * Factory function to create a configured NotionTaskManager
 */
export function createTaskManager(
	notionToken: string,
	databaseConfig: DatabaseConfig,
): NotionTaskManager {
	const client = new NotionTaskClient({ auth: notionToken });
	return new NotionTaskManager(client.getClient(), databaseConfig);
}

/**
 * Default database configuration for a typical task management setup
 */
export const DEFAULT_DATABASE_CONFIG: Omit<DatabaseConfig, "databaseId"> = {
	titleProperty: "Name",
	statusProperty: "Status",
	priorityProperty: "Priority",
	dueDateProperty: "Due Date",
	assigneeProperty: "Assignee",
	tagsProperty: "Tags",
	descriptionProperty: "Description",
};

/**
 * Validate that a database ID is properly formatted
 */
export function validateDatabaseId(databaseId: string): boolean {
	// Notion database IDs are 32 characters long (UUID without hyphens)
	// or 36 characters with hyphens
	const cleanId = databaseId.replace(/-/g, "");
	return /^[a-f0-9]{32}$/i.test(cleanId);
}

/**
 * Clean and format a database ID
 */
export function formatDatabaseId(databaseId: string): string {
	return databaseId.replace(/-/g, "");
}

/**
 * Create a complete database configuration with validation
 */
export function createDatabaseConfig(
	databaseId: string,
	customConfig?: Partial<DatabaseConfig>,
): DatabaseConfig {
	if (!validateDatabaseId(databaseId)) {
		throw new Error("Invalid database ID format");
	}

	return {
		databaseId: formatDatabaseId(databaseId),
		...DEFAULT_DATABASE_CONFIG,
		...customConfig,
	};
}
