import { AgentExecutionService } from "@notion-task-manager/db";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get user from database for token refresh capability
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			console.error("User not found in database:", session.user.id);
			return {
				databases: [],
				executions: [],
			};
		}

		// Create Notion client with automatic token refresh
		const notionManager = createNotionTaskManagerWithAuth(user);

		// Fetch available databases for selection
		const databases = await notionManager.getDatabases();

		// Fetch user's recent execution history
		let executions: Awaited<
			ReturnType<AgentExecutionService["getUserExecutions"]>
		> = [];
		try {
			const executionService = new AgentExecutionService();
			executions = await executionService.getUserExecutions(user.id, 10);
		} catch (historyError) {
			console.error("Failed to load execution history:", historyError);
			// Continue with empty history - non-critical error
		}

		return {
			databases: databases.map((db) => ({
				id: db.id,
				title: db.title,
				description: db.description,
			})),
			executions,
		};
	} catch (error) {
		console.error("Failed to load agent page data:", error);

		// Return empty data on error
		// The UI will handle this gracefully and show appropriate messaging
		return {
			databases: [],
			executions: [],
		};
	}
};
