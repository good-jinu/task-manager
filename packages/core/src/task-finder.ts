// Task search agent using AI SDK with tool-based approach

import { createDeepInfra } from "@ai-sdk/deepinfra";
import type { NotionTaskManager } from "@notion-task-manager/notion";
import { generateText } from "ai";
import { z } from "zod";
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

		// Fetch all pages from the database
		const pages = await this.notionManager.getDatabasePages(query.databaseId);

		if (pages.length === 0) {
			return {
				results: [],
				totalCount: 0,
				searchTime: Date.now() - startTime,
				query,
			};
		}

		// Prepare pages data for the agent
		const pagesData = pages.map((page) => ({
			id: page.id,
			title: page.title,
			properties: this.extractProperties(page.properties),
			createdTime: page.createdTime.toISOString(),
		}));

		const maxResults = query.maxResults || 10;
		const dateContext = query.targetDate
			? `The user is looking for tasks around ${query.targetDate.toISOString()}.`
			: "";

		// Variable to capture tool results
		let selectedPages: SelectedPage[] = [];

		// Create OpenAI-compatible client
		const provider = createDeepInfra({
			apiKey: process.env.DEEPINFRA_API_KEY,
		});

		// Use AI SDK with tool-based approach
		const response = await generateText({
			model: provider(process.env.DEEPINFRA_MODEL || "gpt-4o-mini"),
			tools: {
				setSearchResults: {
					description:
						"Set the search results with selected pages. Call this tool once with all relevant pages.",
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
			prompt: `You are a task search assistant. Analyze the following pages and select the most relevant ones based on the user's query.

User Query: "${query.description}"
${dateContext}

Available Pages:
${JSON.stringify(pagesData, null, 2)}

Instructions:
1. Analyze each page's title and properties for relevance to the query
2. Consider semantic meaning, not just keyword matching
3. Select up to ${maxResults} most relevant pages
4. Score each from 0.0 to 1.0 (1.0 = perfect match)
5. Provide brief reasoning for each selection
6. Only include pages that are actually relevant (score > 0.3)
7. Call the setSearchResults tool with your selections`,
		});

		console.log(response.content);

		// Map selections back to full page data
		const results: SearchResult[] = [];
		for (const selection of selectedPages) {
			const page = pages.find((p) => p.id === selection.pageId);
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
			totalCount: pages.length,
			searchTime: Date.now() - startTime,
			query,
		};
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
