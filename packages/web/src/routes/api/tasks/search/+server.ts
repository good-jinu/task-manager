import { TaskFinderImpl } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";
import type { RequestHandler } from "./$types";

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

		// Parse target date if provided
		let parsedTargetDate: Date | undefined;
		if (targetDate?.trim()) {
			parsedTargetDate = new Date(targetDate.trim());
			if (Number.isNaN(parsedTargetDate.getTime())) {
				return json({ error: "Invalid target date format" }, { status: 400 });
			}
		}

		// Create Notion client and TaskFinder
		const notionManager = createNotionTaskManagerWithAuth(user);
		const taskFinder = new TaskFinderImpl(notionManager);

		// Execute search
		const searchResult = await taskFinder.search({
			description: description.trim(),
			targetDate: parsedTargetDate,
			userId: user.id,
			databaseId,
			maxResults: maxResults || 10,
		});

		// Convert Date objects to strings for JSON response
		const clientResult = {
			...searchResult,
			results: searchResult.results.map((result) => ({
				...result,
				page: {
					...result.page,
					createdTime: result.page.createdTime.toISOString(),
					lastEditedTime: result.page.lastEditedTime.toISOString(),
				},
			})),
		};

		return json({ success: true, data: clientResult });
	} catch (error) {
		console.error("Task search failed:", error);

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
