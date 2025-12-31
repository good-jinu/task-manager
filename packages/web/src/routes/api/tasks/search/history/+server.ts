import { SearchHistoryService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const session = await requireAuth(event);

		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		// Get optional limit from query params
		const url = new URL(event.request.url);
		const limitParam = url.searchParams.get("limit");
		const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

		if (Number.isNaN(limit) || limit < 1 || limit > 100) {
			return json(
				{ error: "Limit must be a number between 1 and 100" },
				{ status: 400 },
			);
		}

		// Query user's search history from DynamoDB
		const searchHistoryService = new SearchHistoryService();
		const searches = await searchHistoryService.getUserSearchHistory(
			user.id,
			limit,
		);

		// Return sorted by createdAt descending (already sorted by service)
		return json({
			success: true,
			searches,
		});
	} catch (error) {
		console.error("Failed to get search history:", error);

		if (error instanceof Error) {
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token")
			) {
				return json({ error: "Authentication error" }, { status: 401 });
			}
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
