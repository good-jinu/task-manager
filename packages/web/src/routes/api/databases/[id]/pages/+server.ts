import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const databaseId = event.params.id;
		if (!databaseId) {
			return json({ error: "Database ID is required" }, { status: 400 });
		}

		// Create Notion client with user's access token
		const notionManager = createNotionTaskManagerWithAuth(
			session.user.notionAccessToken,
		);

		// Get all pages from the database
		const pages = await notionManager.getDatabasePages(databaseId);

		// Convert Date objects to strings for client compatibility
		const clientPages = pages.map((page) => ({
			...page,
			createdTime: page.createdTime.toISOString(),
			lastEditedTime: page.lastEditedTime.toISOString(),
		}));

		return json({ pages: clientPages });
	} catch (error) {
		console.error("Failed to fetch database pages:", error);
		return json({ error: "Failed to fetch database pages" }, { status: 500 });
	}
};
