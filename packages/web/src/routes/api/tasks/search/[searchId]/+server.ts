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

		const { searchId } = event.params;

		if (!searchId || typeof searchId !== "string" || !searchId.trim()) {
			return json({ error: "Search ID is required" }, { status: 400 });
		}

		// Retrieve specific search by ID
		const searchHistoryService = new SearchHistoryService();
		const search = await searchHistoryService.getSearchById(user.id, searchId);

		if (!search) {
			return json({ error: "Search not found" }, { status: 404 });
		}

		// Return search record with status and results
		return json({
			success: true,
			search,
		});
	} catch (error) {
		console.error("Failed to get search:", error);

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
