import { SearchHistoryService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";
import { processSearchInBackground } from "./processor";

export const POST: RequestHandler = async (event) => {
	try {
		const session = await requireAuth(event);

		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		const requestBody = await event.request.json();
		const { description, targetDate, databaseId, maxResults } = requestBody;

		// Validate required fields
		if (
			!description ||
			typeof description !== "string" ||
			!description.trim()
		) {
			return json(
				{ error: "Description is required and must be a non-empty string" },
				{ status: 400 },
			);
		}

		if (!databaseId || typeof databaseId !== "string") {
			return json(
				{ error: "Database ID is required and must be a string" },
				{ status: 400 },
			);
		}

		// Validate target date if provided
		if (targetDate?.trim()) {
			const parsedDate = new Date(targetDate.trim());
			if (Number.isNaN(parsedDate.getTime())) {
				return json({ error: "Invalid target date format" }, { status: 400 });
			}
		}

		// Create pending search record
		const searchHistoryService = new SearchHistoryService();
		const searchRecord = await searchHistoryService.createSearch(user.id, {
			description: description.trim(),
			databaseId,
			targetDate: targetDate?.trim(),
			maxResults: maxResults || 10,
		});

		// Trigger background processing (non-blocking)
		processSearchInBackground(user, searchRecord.searchId, {
			description: description.trim(),
			databaseId,
			targetDate: targetDate?.trim(),
			maxResults: maxResults || 10,
		});

		// Return immediately with searchId and pending status
		return json({
			success: true,
			searchId: searchRecord.searchId,
			status: "pending",
		});
	} catch (error) {
		console.error("Task search submission failed:", error);

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
