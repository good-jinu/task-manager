import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

interface NotionDatabase {
	id: string;
	name: string;
	url?: string;
	icon?: {
		type: "emoji" | "external" | "file";
		emoji?: string;
		external?: { url: string };
		file?: { url: string };
	};
	properties: Record<string, unknown>;
	created_time: string;
	last_edited_time: string;
}

/**
 * GET /api/integrations/notion/databases
 * Lists all accessible Notion databases for the authenticated user
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		// Get user data to access Notion tokens
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found" }, { status: 404 });
		}

		if (!user.notionAccessToken) {
			return json(
				{
					error:
						"Notion integration not configured. Please connect your Notion account first.",
				},
				{ status: 400 },
			);
		}

		// Create Notion client with user's auth tokens
		const notionTaskManager = createNotionTaskManagerWithAuth(user);

		// Get databases using the public method
		const databases = await notionTaskManager.getDatabases();

		// Transform to our API format
		const formattedDatabases: NotionDatabase[] = databases.map((db) => ({
			id: db.id,
			name: db.title,
			url: db.url,
			icon: undefined, // NotionDatabase interface doesn't include icon
			properties: {}, // We don't need to expose all properties
			created_time: db.createdTime.toISOString(),
			last_edited_time: db.lastEditedTime.toISOString(),
		}));

		// Cache the result for a short time to avoid repeated API calls
		event.setHeaders({
			"Cache-Control": "private, max-age=300", // 5 minutes
		});

		return json({
			databases: formattedDatabases,
			total: formattedDatabases.length,
		});
	} catch (error) {
		console.error("Failed to fetch Notion databases:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		// Handle specific Notion API errors
		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json(
					{
						error:
							"Notion access token is invalid or expired. Please reconnect your account.",
						code: "TOKEN_INVALID",
					},
					{ status: 401 },
				);
			}

			if (error.message.includes("rate limit")) {
				return json(
					{
						error: "Rate limit exceeded. Please try again later.",
						code: "RATE_LIMITED",
					},
					{ status: 429 },
				);
			}

			if (error.message.includes("forbidden")) {
				return json(
					{
						error:
							"Insufficient permissions to access databases. Please check your Notion integration permissions.",
						code: "INSUFFICIENT_PERMISSIONS",
					},
					{ status: 403 },
				);
			}
		}

		return json(
			{
				error: "Failed to fetch databases from Notion",
			},
			{ status: 500 },
		);
	}
};
