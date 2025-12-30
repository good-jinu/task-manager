import { getDatabaseClient } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get user data from database (includes tokens)
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		// Create Notion client with automatic token refresh
		const notionManager = createNotionTaskManagerWithAuth(user);

		// Get all databases from Notion
		// Token refresh will happen automatically if needed
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

		if (error instanceof Error) {
			// Handle token refresh errors
			if (
				error.message.includes("Token refresh failed") ||
				error.message.includes("No refresh token")
			) {
				return json(
					{
						error:
							"Authentication tokens expired. Please re-authenticate with Notion.",
					},
					{ status: 401 },
				);
			}
		}

		return json({ error: "Failed to fetch databases" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get user data from database
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

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
			user.id, // Use database user ID
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

		if (error instanceof Error) {
			// Handle token refresh errors
			if (
				error.message.includes("Token refresh failed") ||
				error.message.includes("No refresh token")
			) {
				return json(
					{
						error:
							"Authentication tokens expired. Please re-authenticate with Notion.",
					},
					{ status: 401 },
				);
			}
		}

		return json(
			{ error: "Failed to save database configuration" },
			{ status: 500 },
		);
	}
};
