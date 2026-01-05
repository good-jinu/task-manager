import { AgentExecutionService } from "@notion-task-manager/db";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	try {
		// Check if user is authenticated
		const session = await event.locals.auth();

		if (session?.user?.id) {
			// Authenticated user - load full data
			const user = await getUserFromDatabase(session.user.id);
			if (!user) {
				console.error("User not found in database:", session.user.id);
				return {
					databases: [],
					executions: [],
					isAuthenticated: true,
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
				isAuthenticated: true,
			};
		} else {
			// Guest user - return minimal data
			return {
				databases: [], // No Notion databases for guests
				executions: [], // No execution history for guests
				isAuthenticated: false,
			};
		}
	} catch (error) {
		console.error("Failed to load agent page data:", error);

		// Return empty data on error
		return {
			databases: [],
			executions: [],
			isAuthenticated: false,
		};
	}
};
