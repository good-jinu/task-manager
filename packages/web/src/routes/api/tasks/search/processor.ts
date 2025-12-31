import { TaskFinderImpl } from "@notion-task-manager/core";
import type { User } from "@notion-task-manager/db";
import { SearchHistoryService } from "@notion-task-manager/db";
import { createNotionTaskManagerWithAuth } from "$lib/notion";

interface SearchInput {
	description: string;
	databaseId: string;
	targetDate?: string;
	maxResults: number;
}

/**
 * Process search in background without blocking the response.
 * Updates the search record with results on success or error on failure.
 */
export function processSearchInBackground(
	user: User,
	searchId: string,
	input: SearchInput,
): void {
	// Execute search asynchronously without awaiting
	executeSearch(user, searchId, input).catch((error) => {
		console.error(`Background search failed for searchId ${searchId}:`, error);
	});
}

async function executeSearch(
	user: User,
	searchId: string,
	input: SearchInput,
): Promise<void> {
	const searchHistoryService = new SearchHistoryService();

	try {
		// Create Notion client and TaskFinder
		const notionManager = createNotionTaskManagerWithAuth(user);
		const taskFinder = new TaskFinderImpl(notionManager);

		// Parse target date if provided
		let parsedTargetDate: Date | undefined;
		if (input.targetDate) {
			parsedTargetDate = new Date(input.targetDate);
		}

		// Execute search
		const searchResult = await taskFinder.search({
			description: input.description,
			targetDate: parsedTargetDate,
			userId: user.id,
			databaseId: input.databaseId,
			maxResults: input.maxResults,
		});

		// Convert results to storage format
		const results = searchResult.results.map((result) => ({
			id: result.page.id,
			title: result.page.title,
			url: result.page.url,
			properties: result.page.properties as Record<string, unknown>,
		}));

		// Update search record with success
		await searchHistoryService.updateSearchStatus(user.id, searchId, "done", {
			results,
			searchTime: searchResult.searchTime,
			totalCount: searchResult.totalCount,
		});
	} catch (error) {
		// Update search record with failure
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		await searchHistoryService.updateSearchStatus(user.id, searchId, "fail", {
			error: errorMessage,
		});
	}
}
