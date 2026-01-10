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

// Simple in-memory cache for databases (in production, use Redis or similar)
const databaseCache = new Map<
	string,
	{ data: NotionDatabase[]; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/integrations/notion/databases
 * Lists all accessible Notion databases for the authenticated user with caching
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		// Check for force refresh parameter
		const forceRefresh = event.url.searchParams.get("refresh") === "true";

		// Check cache first (unless force refresh is requested)
		if (!forceRefresh) {
			const cached = databaseCache.get(session.user.id);
			if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
				// Set cache headers
				event.setHeaders({
					"Cache-Control": "private, max-age=300", // 5 minutes
					"X-Cache": "HIT",
				});

				return json({
					databases: cached.data,
					total: cached.data.length,
					cached: true,
					cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000),
				});
			}
		}

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
					code: "NO_ACCESS_TOKEN",
					requiresAuth: true,
				},
				{ status: 400 },
			);
		}

		// Check if token is expired
		if (user.tokenExpiresAt) {
			const expiresAt = new Date(user.tokenExpiresAt);
			const now = new Date();

			if (now >= expiresAt) {
				return json(
					{
						error:
							"Notion access token has expired. Please refresh your token or reconnect.",
						code: "TOKEN_EXPIRED",
						requiresRefresh: true,
					},
					{ status: 401 },
				);
			}
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
			properties: {}, // We don't need to expose all properties for security
			created_time: db.createdTime.toISOString(),
			last_edited_time: db.lastEditedTime.toISOString(),
		}));

		// Cache the result
		databaseCache.set(session.user.id, {
			data: formattedDatabases,
			timestamp: Date.now(),
		});

		// Set cache headers
		event.setHeaders({
			"Cache-Control": "private, max-age=300", // 5 minutes
			"X-Cache": "MISS",
		});

		return json({
			databases: formattedDatabases,
			total: formattedDatabases.length,
			cached: false,
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
						requiresReauth: true,
					},
					{ status: 401 },
				);
			}

			if (error.message.includes("rate limit")) {
				return json(
					{
						error: "Rate limit exceeded. Please try again later.",
						code: "RATE_LIMITED",
						retryAfter: 60, // seconds
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
						requiresReauth: true,
					},
					{ status: 403 },
				);
			}

			if (
				error.message.includes("network") ||
				error.message.includes("timeout")
			) {
				return json(
					{
						error: "Network error connecting to Notion. Please try again.",
						code: "NETWORK_ERROR",
						retryable: true,
					},
					{ status: 503 },
				);
			}
		}

		return json(
			{
				error: "Failed to fetch databases from Notion",
				code: "FETCH_FAILED",
			},
			{ status: 500 },
		);
	}
};

/**
 * DELETE /api/integrations/notion/databases
 * Clears the database cache for the authenticated user
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		// Clear cache for this user
		const hadCache = databaseCache.has(session.user.id);
		databaseCache.delete(session.user.id);

		return json({
			success: true,
			message: "Database cache cleared",
			hadCache,
		});
	} catch (error) {
		console.error("Failed to clear database cache:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to clear cache",
			},
			{ status: 500 },
		);
	}
};
