import { requireAuth } from "$lib/auth";
import { createNotionTaskManager } from "$lib/notion";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Create Notion client with user's access token
		const notionManager = createNotionTaskManager(
			session.user.notionAccessToken,
		);

		// Fetch available databases
		const databases = await notionManager.getDatabases();

		return {
			databases: databases.map((db) => ({
				id: db.id,
				title: db.title,
				description: db.description,
			})),
		};
	} catch (error) {
		console.error("Failed to load databases for search page:", error);

		// Return empty databases array on error
		// The UI will handle this gracefully and show appropriate messaging
		return {
			databases: [],
		};
	}
};
