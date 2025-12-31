import type {
	NotionPage,
	NotionTaskManager,
} from "@notion-task-manager/notion";
import { formatPagesForAI } from "@notion-task-manager/notion";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { getModel } from "./llm/provider";
import type { SearchQuery, SearchResult, TaskSearchResult } from "./types";

export interface TaskFinder {
	search(query: SearchQuery): Promise<TaskSearchResult>;
}

const SelectedPageSchema = z.object({
	pageId: z.string().describe("The ID of the selected page"),
	reasoning: z
		.string()
		.describe("Brief explanation of why this page is relevant"),
});

type SelectedPage = z.infer<typeof SelectedPageSchema>;

export class TaskFinderImpl implements TaskFinder {
	private notionManager: NotionTaskManager;

	constructor(notionManager: NotionTaskManager) {
		this.notionManager = notionManager;
	}

	async search(query: SearchQuery): Promise<TaskSearchResult> {
		const startTime = Date.now();

		const maxResults = query.maxResults || 10;
		const dateContext = query.targetDate
			? `The user is looking for tasks around ${query.targetDate.toISOString()}.`
			: "";

		// Variable to capture tool results
		let selectedPages: SelectedPage[] = [];

		// Track all pages fetched by the AI for totalCount
		let allFetchedPages: NotionPage[] = [];

		// Use AI SDK with tool-based approach
		const response = await generateText({
			model: getModel(),
			tools: {
				queryDatabase: {
					description:
						"Query Notion database with title filter to narrow results. Use this when you want to search for pages with specific keywords in their title.",
					inputSchema: z.object({
						databaseId: z
							.string()
							.describe("The ID of the Notion database to query"),
						titleQuery: z
							.string()
							.describe(
								"The search string to filter page titles (case-insensitive contains match)",
							),
					}),
					execute: async ({ databaseId, titleQuery }) => {
						try {
							const pages = await this.notionManager.queryDatabasePages(
								databaseId,
								titleQuery,
							);
							allFetchedPages = [...allFetchedPages, ...pages];
							return formatPagesForAI(pages);
						} catch (error) {
							return {
								error:
									error instanceof Error
										? error.message
										: "Failed to query database",
							};
						}
					},
				},
				viewAllPages: {
					description:
						"Retrieve all pages from a Notion database. Use this for comprehensive searches when you need to see all available pages.",
					inputSchema: z.object({
						databaseId: z
							.string()
							.describe("The ID of the Notion database to retrieve pages from"),
					}),
					execute: async ({ databaseId }) => {
						try {
							const pages =
								await this.notionManager.getAllDatabasePages(databaseId);
							allFetchedPages = [...allFetchedPages, ...pages];
							return formatPagesForAI(pages);
						} catch (error) {
							return {
								error:
									error instanceof Error
										? error.message
										: "Failed to retrieve pages",
							};
						}
					},
				},
				setSearchResults: {
					description:
						"Set the search results with selected pages sorted by relevance (most relevant first). Call this tool once with all relevant pages after you have analyzed the available pages.",
					inputSchema: z.object({
						selectedPages: z
							.array(SelectedPageSchema)
							.describe(
								"Array of selected pages sorted by relevance (most relevant first)",
							),
					}),
					execute: async ({ selectedPages: pages }) => {
						selectedPages = pages;
						return { success: true, count: pages.length };
					},
				},
			},
			toolChoice: "required",
			stopWhen: stepCountIs(5),
			prompt: `You are a task search assistant. Your goal is to find the most relevant pages based on the user's query.

User Query: "${query.description}"
Database ID: ${query.databaseId}
${dateContext}

You have access to the following tools:
1. queryDatabase - Query Notion database with title filter to narrow results. Use this when the user's query contains specific keywords that might appear in page titles. This is efficient for targeted searches.
2. viewAllPages - Retrieve all pages from a Notion database. Use this for comprehensive semantic searches when you need to analyze all content, or when the query is broad/abstract.
3. setSearchResults - Submit your final selection of relevant pages.

Search Strategy:
- For queries with specific keywords (e.g., "meeting notes", "project X", "bug fixes"): Start with queryDatabase to filter by title
- For broad/semantic queries (e.g., "tasks I should prioritize", "recent work"): Use viewAllPages to see everything
- You can call queryDatabase multiple times with different keywords if needed
- You can combine approaches: filter first, then get all pages if filtered results are insufficient

Instructions:
1. Analyze the user's query to determine the best search strategy
2. Call the appropriate tool(s) to retrieve pages
3. Analyze the returned pages for relevance to the query
4. Consider semantic meaning, not just keyword matching
5. Select up to ${maxResults} most relevant pages
6. Sort the results by relevance (most relevant first)
7. Provide brief reasoning for each selection
8. Only include pages that are actually relevant to the query
9. Call setSearchResults with your final selections (sorted by relevance)`,
		});

		console.log(response.text);

		// Deduplicate fetched pages by ID
		const uniquePages = new Map<string, NotionPage>();
		for (const page of allFetchedPages) {
			uniquePages.set(page.id, page);
		}

		// Map selections back to full page data (already sorted by relevance from AI)
		const results: SearchResult[] = [];
		for (const selection of selectedPages) {
			const page = uniquePages.get(selection.pageId);
			if (page) {
				results.push({
					page,
					reasoning: selection.reasoning,
				});
			}
		}

		return {
			results: results.slice(0, maxResults),
			totalCount: uniquePages.size,
			searchTime: Date.now() - startTime,
			query,
		};
	}
}
