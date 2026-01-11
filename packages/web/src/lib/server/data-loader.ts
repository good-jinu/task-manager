import type { Session } from "@auth/sveltekit";
import { AgentExecutionService } from "@notion-task-manager/db";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import type { NotionDatabase } from "$lib/types/notion";
import { getUserFromDatabase } from "$lib/user";

export interface PageData {
	session: Session | null;
	databases: NotionDatabase[];
	executions: Awaited<ReturnType<AgentExecutionService["getUserExecutions"]>>;
	isAuthenticated: boolean;
}

/**
 * Load databases for authenticated users
 */
export async function loadDatabases(userId: string): Promise<NotionDatabase[]> {
	try {
		const user = await getUserFromDatabase(userId);
		if (!user) {
			console.error("User not found in database:", userId);
			return [];
		}

		// Create Notion client with automatic token refresh
		const notionManager = createNotionTaskManagerWithAuth(user);

		// Fetch available databases for selection
		const dbResults = await notionManager.getDatabases();
		return dbResults.map((db) => ({
			id: db.id,
			title: db.title,
			description: db.description,
		}));
	} catch (error) {
		console.error("Failed to load databases:", error);
		return [];
	}
}

/**
 * Load execution history for authenticated users
 */
export async function loadExecutions(
	userId: string,
	limit: number = 10,
): Promise<Awaited<ReturnType<AgentExecutionService["getUserExecutions"]>>> {
	try {
		const executionService = new AgentExecutionService();
		return await executionService.getUserExecutions(userId, limit);
	} catch (error) {
		console.error("Failed to load execution history:", error);
		return [];
	}
}

/**
 * Load data for authenticated users
 */
export async function loadAuthenticatedUserData(
	userId: string,
): Promise<Partial<PageData>> {
	const [databases, executions] = await Promise.all([
		loadDatabases(userId),
		loadExecutions(userId),
	]);

	return {
		databases,
		executions,
		isAuthenticated: true,
	};
}

/**
 * Load data for guest users
 */
export function loadGuestUserData(): Partial<PageData> {
	return {
		databases: [], // No Notion databases for guests
		executions: [], // No execution history for guests
		isAuthenticated: false,
	};
}

/**
 * Create error fallback data
 */
export function createErrorFallback(session: Session | null): PageData {
	return {
		session,
		databases: [],
		executions: [],
		isAuthenticated: false,
	};
}
