import type {
	NotionPage,
	NotionTaskManager,
} from "@notion-task-manager/notion";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { getModel } from "./llm/provider.js";
import type { SearchQuery, SearchResult, TaskSearchResult } from "./types.js";

export interface TaskFinder {
	search(query: SearchQuery): Promise<TaskSearchResult>;
}

const SelectedPageSchema = z.object({
	pageId: z.string().describe("The ID of the selected page"),
	relevanceScore: z
		.number()
		.min(0)
		.max(1)
		.describe("Relevance score from 0 to 1"),
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
							return this.formatPagesForAI(pages);
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
							return this.formatPagesForAI(pages);
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
						"Set the search results with selected pages. Call this tool once with all relevant pages after you have analyzed the available pages.",
					inputSchema: z.object({
						selectedPages: z
							.array(SelectedPageSchema)
							.describe("Array of selected pages with relevance scores"),
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
3. setSearchResults - Submit your final selection of relevant pages with relevance scores.

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
6. Score each from 0.0 to 1.0 (1.0 = perfect match)
7. Provide brief reasoning for each selection
8. Only include pages that are actually relevant (score > 0.3)
9. Call setSearchResults with your final selections`,
		});

		console.log(response.text);

		// Deduplicate fetched pages by ID
		const uniquePages = new Map<string, NotionPage>();
		for (const page of allFetchedPages) {
			uniquePages.set(page.id, page);
		}

		// Map selections back to full page data
		const results: SearchResult[] = [];
		for (const selection of selectedPages) {
			const page = uniquePages.get(selection.pageId);
			if (page) {
				results.push({
					page,
					relevanceScore: selection.relevanceScore,
					reasoning: selection.reasoning,
				});
			}
		}

		// Sort by relevance score
		results.sort((a, b) => b.relevanceScore - a.relevanceScore);

		return {
			results: results.slice(0, maxResults),
			totalCount: uniquePages.size,
			searchTime: Date.now() - startTime,
			query,
		};
	}

	/**
	 * Format pages for AI consumption as JSON-serializable array
	 */
	private formatPagesForAI(pages: NotionPage[]): object[] {
		return pages.map((page) => ({
			id: page.id,
			title: page.title,
			url: page.url,
			createdTime: page.createdTime.toISOString(),
			lastEditedTime: page.lastEditedTime.toISOString(),
			archived: page.archived,
			properties: this.extractProperties(page.properties),
		}));
	}

	private extractProperties(
		properties: Record<string, unknown>,
	): Record<string, string> {
		const extracted: Record<string, string> = {};

		for (const [key, value] of Object.entries(properties)) {
			const text = this.extractPropertyText(value);
			if (text) {
				extracted[key] = text;
			}
		}

		return extracted;
	}

	private extractPropertyText(property: unknown): string {
		if (!property || typeof property !== "object") return "";

		const prop = property as Record<string, unknown>;
		const type = prop.type as string;

		switch (type) {
			case "title":
				return (
					(prop.title as Array<{ plain_text?: string }>)
						?.map((t) => t.plain_text || "")
						.join(" ") || ""
				);
			case "rich_text":
				return (
					(prop.rich_text as Array<{ plain_text?: string }>)
						?.map((t) => t.plain_text || "")
						.join(" ") || ""
				);
			case "select":
				return (prop.select as { name?: string })?.name || "";
			case "multi_select":
				return (
					(prop.multi_select as Array<{ name?: string }>)
						?.map((s) => s.name || "")
						.join(", ") || ""
				);
			case "number":
				return (prop.number as number)?.toString() || "";
			case "checkbox":
				return prop.checkbox ? "checked" : "unchecked";
			case "date":
				return (prop.date as { start?: string })?.start || "";
			case "url":
				return (prop.url as string) || "";
			case "email":
				return (prop.email as string) || "";
			default:
				return "";
		}
	}
}
