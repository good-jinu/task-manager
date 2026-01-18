import type { User } from "@task-manager/db";
import { createNotionTaskManagerWithAuth as createNotionClient } from "@task-manager/db";
import type { NotionTaskManager } from "@task-manager/notion";
import { AUTH_NOTION_ID, AUTH_NOTION_SECRET } from "$env/static/private";

/**
 * Create a NotionTaskManager with automatic token refresh capability
 * @param user - User object with tokens
 * @returns NotionTaskManager with auth client
 */
export function createNotionTaskManagerWithAuth(user: User): NotionTaskManager {
	return createNotionClient(user, AUTH_NOTION_ID, AUTH_NOTION_SECRET);
}
