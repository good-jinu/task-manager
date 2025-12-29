import { TaskFinderImpl } from "@notion-task-manager/core";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManager } from "$lib/notion";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Parse and validate request body
		const requestBody = await event.request.json();
		const {
			description,
			relativeDate,
			databaseId,
			maxResults,
			includeContent,
		} = requestBody;

		// Validate required fields
		if (!description || typeof description !== "string") {
			return json(
				{ error: "Description is required and must be a string" },
				{ status: 400 },
			);
		}

		if (description.trim().length === 0) {
			return json({ error: "Description cannot be empty" }, { status: 400 });
		}

		if (!databaseId || typeof databaseId !== "string") {
			return json(
				{ error: "Database ID is required and must be a string" },
				{ status: 400 },
			);
		}

		// Validate optional fields
		if (relativeDate !== undefined && typeof relativeDate !== "string") {
			return json({ error: "Relative date must be a string" }, { status: 400 });
		}

		if (maxResults !== undefined) {
			if (
				typeof maxResults !== "number" ||
				maxResults < 1 ||
				maxResults > 100
			) {
				return json(
					{ error: "Max results must be a number between 1 and 100" },
					{ status: 400 },
				);
			}
		}

		if (includeContent !== undefined && typeof includeContent !== "boolean") {
			return json(
				{ error: "Include content must be a boolean" },
				{ status: 400 },
			);
		}

		// Create Notion client with user's access token
		const notionManager = createNotionTaskManager(
			session.user.notionAccessToken,
		);

		// Create TaskFinder instance
		const taskFinder = new TaskFinderImpl(notionManager);

		// Build search query
		const searchQuery = {
			description: description.trim(),
			relativeDate,
			userId: session.user.id,
			databaseId,
			maxResults: maxResults || 10,
			includeContent: includeContent || false,
		};

		// Execute search
		const searchResult = await taskFinder.search(searchQuery);

		// Convert Date objects to strings for client compatibility
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

		// Handle specific error types
		if (error instanceof Error) {
			// Check for validation errors (400 status)
			if (
				error.message.includes("required") ||
				error.message.includes("must be") ||
				error.message.includes("cannot be empty")
			) {
				return json({ error: error.message }, { status: 400 });
			}

			// Check for authentication/authorization errors (401/403 status)
			if (
				error.message.includes("unauthorized") ||
				error.message.includes("access token") ||
				error.message.includes("permission")
			) {
				return json(
					{ error: "Authentication or permission error" },
					{ status: 401 },
				);
			}

			// Check for OpenAI API errors (502 status for external service)
			if (
				error.message.includes("OpenAI") ||
				error.message.includes("API key") ||
				error.message.includes("rate limit")
			) {
				return json({ error: "External service error" }, { status: 502 });
			}
		}

		// Generic server error for all other cases
		return json(
			{ error: "Internal server error occurred during task search" },
			{ status: 500 },
		);
	}
};

// Health check endpoint
export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Create Notion client with user's access token
		const notionManager = createNotionTaskManager(
			session.user.notionAccessToken,
		);

		// Create TaskFinder instance
		const taskFinder = new TaskFinderImpl(notionManager);

		// Perform health check
		const isHealthy = await taskFinder.healthCheck();

		if (isHealthy) {
			return json({
				status: "healthy",
				message: "Task search service is operational",
			});
		} else {
			return json(
				{
					status: "unhealthy",
					message: "Task search service is not functioning properly",
				},
				{ status: 503 },
			);
		}
	} catch (error) {
		console.error("Health check failed:", error);
		return json(
			{
				status: "error",
				message: "Health check could not be completed",
			},
			{ status: 503 },
		);
	}
};
