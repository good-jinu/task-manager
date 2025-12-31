import {
	type SearchHistoryRecord,
	SearchHistoryService,
} from "@notion-task-manager/db";
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
				searchHistory: [],
			};
		}

		// Create Notion client with automatic token refresh
		const notionManager = createNotionTaskManagerWithAuth(user);

		// Fetch available databases
		const databases = await notionManager.getDatabases();

		// Fetch user's search history
		let searchHistory: SearchHistoryRecord[] = [];
		try {
			const searchHistoryService = new SearchHistoryService();
			searchHistory = await searchHistoryService.getUserSearchHistory(
				user.id,
				5,
			);
		} catch (historyError) {
			console.error("Failed to load search history:", historyError);
			// Continue with empty history - non-critical error
		}

		return {
			databases: databases.map((db) => ({
				id: db.id,
				title: db.title,
				description: db.description,
			})),
			searchHistory,
		};
	} catch (error) {
		console.error("Failed to load databases for search page:", error);

		// Return empty databases array on error
		// The UI will handle this gracefully and show appropriate messaging
		return {
			databases: [],
			searchHistory: [],
		};
	}
};
