import { getDatabaseClient } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManager } from "$lib/notion";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Create Notion client with user's access token
		const notionManager = createNotionTaskManager(
			session.user.notionAccessToken,
		);

		// Get all databases from Notion
		const databases = await notionManager.getDatabases();

		// Convert Date objects to strings for client compatibility
		const clientDatabases = databases.map((db) => ({
			...db,
			createdTime: db.createdTime.toISOString(),
			lastEditedTime: db.lastEditedTime.toISOString(),
		}));

		return json({ databases: clientDatabases });
	} catch (error) {
		console.error("Failed to fetch databases:", error);
		return json({ error: "Failed to fetch databases" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const { databaseId, title, description } = await event.request.json();

		if (!databaseId || !title) {
			return json(
				{ error: "Database ID and title are required" },
				{ status: 400 },
			);
		}

		// Save database configuration
		const db = getDatabaseClient();
		const config = await db.databaseConfigs.saveDatabaseConfig(
			session.user.id,
			{
				databaseId,
				title,
				description,
			},
		);

		// Convert Date objects to strings for client compatibility
		const clientConfig = {
			...config,
			selectedAt: config.selectedAt.toISOString(),
		};

		return json({ config: clientConfig });
	} catch (error) {
		console.error("Failed to save database configuration:", error);
		return json(
			{ error: "Failed to save database configuration" },
			{ status: 500 },
		);
	}
};
