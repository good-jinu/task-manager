// Search engine for task finding

import type {
	NotionPage,
	NotionTaskManager,
} from "@notion-task-manager/notion";
import type { OpenAIClient } from "../agent/openai-client.js";
import { OpenAIClientImpl } from "../agent/openai-client.js";
import type { RankedResult, SearchQuery } from "../agent/types.js";
import type {
	ScoredResult,
	SearchMetadata,
	TaskSearchResult,
} from "./types.js";

export interface SearchEngine {
	findTasks(query: SearchQuery): Promise<TaskSearchResult>;
	rankByRelevance(
		results: NotionPage[],
		query: string,
	): Promise<ScoredResult[]>;
	rankByDateProximity(
		results: ScoredResult[],
		targetDate: Date,
	): Promise<RankedResult[]>;
}

export class SearchEngineImpl implements SearchEngine {
	private notionManager: NotionTaskManager;
	private openaiClient: OpenAIClient;

	constructor(notionManager: NotionTaskManager, openaiClient?: OpenAIClient) {
		this.notionManager = notionManager;
		this.openaiClient = openaiClient || new OpenAIClientImpl();
	}

	async findTasks(query: SearchQuery): Promise<TaskSearchResult> {
		const startTime = Date.now();
		const metadata: SearchMetadata = {
			openaiTokensUsed: 0,
			notionApiCalls: 0,
			cacheHits: 0,
			processingSteps: [],
		};

		try {
			metadata.processingSteps.push("Starting LLM-powered task search");

			// Step 1: Get all pages from the specified database
			metadata.processingSteps.push("Fetching pages from Notion database");
			const pages = await this.notionManager.getDatabasePages(query.databaseId);
			metadata.notionApiCalls++;

			if (pages.length === 0) {
				metadata.processingSteps.push("No pages found in database");
				return {
					results: [],
					totalCount: 0,
					searchTime: Date.now() - startTime,
					query,
					metadata,
				};
			}

			metadata.processingSteps.push(`Found ${pages.length} pages in database`);

			// Step 2: Use LLM to intelligently select relevant documents
			metadata.processingSteps.push("Using LLM to select relevant documents");
			const maxResults = query.maxResults || 10;
			const llmSelections = await this.openaiClient.selectRelevantDocuments(
				query.description,
				pages,
				maxResults,
			);

			// Step 3: Convert LLM selections to RankedResult format
			const rankedResults: RankedResult[] = [];
			for (const selection of llmSelections) {
				const page = pages.find((p) => p.id === selection.pageId);
				if (page) {
					// Calculate date proximity score if target date is specified
					let dateProximityScore = 0;
					if (query.targetDate && query.targetDate instanceof Date) {
						dateProximityScore = this.calculateDateProximityScore(
							page.createdTime,
							query.targetDate,
						);
					}

					// Combine relevance and date proximity scores
					const combinedScore = query.targetDate
						? selection.relevanceScore * 0.3 + dateProximityScore * 0.7
						: selection.relevanceScore;

					rankedResults.push({
						page,
						relevanceScore: selection.relevanceScore,
						dateProximityScore,
						combinedScore,
					});
				}
			}

			// Sort by combined score
			rankedResults.sort((a, b) => b.combinedScore - a.combinedScore);

			metadata.processingSteps.push(
				`LLM selected ${rankedResults.length} relevant documents`,
			);

			return {
				results: rankedResults,
				totalCount: pages.length,
				searchTime: Date.now() - startTime,
				query,
				metadata,
			};
		} catch (error) {
			metadata.processingSteps.push(
				`Error during LLM search: ${error instanceof Error ? error.message : "Unknown error"}`,
			);

			// Fallback to basic text matching if LLM fails
			console.error("LLM search failed, falling back to basic search:", error);
			return this.fallbackSearch(query, startTime, metadata);
		}
	}

	private async fallbackSearch(
		query: SearchQuery,
		startTime: number,
		metadata: SearchMetadata,
	): Promise<TaskSearchResult> {
		try {
			metadata.processingSteps.push("Falling back to basic text search");

			const pages = await this.notionManager.getDatabasePages(query.databaseId);
			const scoredResults = await this.rankByRelevance(
				pages,
				query.description,
			);

			let rankedResults: RankedResult[];
			if (query.targetDate && query.targetDate instanceof Date) {
				rankedResults = await this.rankByDateProximity(
					scoredResults,
					query.targetDate,
				);
			} else {
				rankedResults = scoredResults.map((result) => ({
					page: result.page,
					relevanceScore: result.relevanceScore,
					dateProximityScore: 0,
					combinedScore: result.relevanceScore,
				}));
			}

			rankedResults.sort((a, b) => b.combinedScore - a.combinedScore);
			const maxResults = query.maxResults || 10;
			const limitedResults = rankedResults.slice(0, maxResults);

			return {
				results: limitedResults,
				totalCount: pages.length,
				searchTime: Date.now() - startTime,
				query,
				metadata,
			};
		} catch (fallbackError) {
			metadata.processingSteps.push("Fallback search also failed");
			throw new Error(
				`Both LLM and fallback search failed: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`,
			);
		}
	}

	async rankByRelevance(
		results: NotionPage[],
		query: string,
	): Promise<ScoredResult[]> {
		if (!results || results.length === 0) {
			return [];
		}

		const queryTerms = this.extractQueryTerms(query);

		return results.map((page) => {
			const relevanceScore = this.calculateRelevanceScore(page, queryTerms);
			return {
				page,
				relevanceScore,
			};
		});
	}

	async rankByDateProximity(
		results: ScoredResult[],
		targetDate: Date,
	): Promise<RankedResult[]> {
		if (!results || results.length === 0) {
			return [];
		}

		return results.map((result) => {
			const page = result.page as NotionPage;
			const dateProximityScore = this.calculateDateProximityScore(
				page.createdTime,
				targetDate,
			);

			// Combine relevance and date proximity scores
			// Weight date proximity higher when date is specified (as per requirements 2.2)
			const combinedScore =
				result.relevanceScore * 0.3 + dateProximityScore * 0.7;

			return {
				page: result.page,
				relevanceScore: result.relevanceScore,
				dateProximityScore,
				combinedScore,
			};
		});
	}

	private extractQueryTerms(query: string): string[] {
		// Extract meaningful terms from the query
		// Remove common stop words and normalize
		const stopWords = new Set([
			"the",
			"a",
			"an",
			"and",
			"or",
			"but",
			"in",
			"on",
			"at",
			"to",
			"for",
			"of",
			"with",
			"by",
			"is",
			"are",
			"was",
			"were",
			"be",
			"been",
			"have",
			"has",
			"had",
			"do",
			"does",
			"did",
			"will",
			"would",
			"could",
			"should",
			"this",
			"that",
			"these",
			"those",
			"i",
			"you",
			"he",
			"she",
			"it",
			"we",
			"they",
		]);

		const terms = query
			.toLowerCase()
			.replace(/[^\w\s]/g, " ")
			.split(/\s+/)
			.filter((term) => term.length > 2 && !stopWords.has(term))
			.filter((term) => /^[a-zA-Z]+$/.test(term));

		return terms;
	}

	private calculateRelevanceScore(
		page: NotionPage,
		queryTerms: string[],
	): number {
		if (queryTerms.length === 0) {
			return 0;
		}

		let score = 0;
		const pageText = this.extractPageText(page).toLowerCase();
		const titleText = page.title.toLowerCase();

		for (const term of queryTerms) {
			// Exact matches
			const titleMatches = (
				titleText.match(new RegExp(`\\b${term}\\b`, "g")) || []
			).length;
			const contentMatches = (
				pageText.match(new RegExp(`\\b${term}\\b`, "g")) || []
			).length;

			// Partial matches (substring)
			const titlePartialMatches = titleText.includes(term) ? 1 : 0;
			const contentPartialMatches = pageText.includes(term) ? 1 : 0;

			// Weight exact matches higher than partial matches
			score += titleMatches * 5; // Exact title matches are most important
			score += contentMatches * 2; // Exact content matches
			score += titlePartialMatches * 3; // Partial title matches
			score += contentPartialMatches * 1; // Partial content matches
		}

		// Bonus for multiple term matches
		const matchedTerms = queryTerms.filter(
			(term) => titleText.includes(term) || pageText.includes(term),
		).length;

		if (matchedTerms > 1) {
			score += matchedTerms * 2; // Bonus for multiple matches
		}

		// Normalize score by query length, but ensure we don't over-penalize
		const normalizedScore = score / Math.max(1, queryTerms.length);

		// Return score between 0 and 1, but allow higher scores for very relevant matches
		return Math.min(1, normalizedScore / 10); // Divide by 10 to keep scores reasonable
	}

	private calculateDateProximityScore(
		createdTime: Date,
		targetDate: Date,
	): number {
		// Calculate how close the creation date is to the target date
		const timeDiff = Math.abs(createdTime.getTime() - targetDate.getTime());

		// Convert to days
		const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

		// Score decreases exponentially with distance
		// Perfect match (same day) = 1.0, 1 day = ~0.9, 7 days = ~0.5, 30 days = ~0.1
		const proximityScore = Math.exp(-daysDiff / 10);

		return Math.max(0, Math.min(1, proximityScore));
	}

	private extractPageText(page: NotionPage): string {
		// Extract searchable text from page properties
		let text = page.title || "";

		// Extract text from properties
		if (page.properties) {
			for (const [, property] of Object.entries(page.properties)) {
				if (property && typeof property === "object") {
					const propertyText = this.extractPropertyText(property);
					if (propertyText) {
						text += ` ${propertyText}`;
					}
				}
			}
		}

		return text;
	}

	// biome-ignore lint/suspicious/noExplicitAny: test
	private extractPropertyText(property: any): string {
		if (!property || typeof property !== "object") {
			return "";
		}

		// Handle different Notion property types
		switch (property.type) {
			case "title":
				return (
					// biome-ignore lint/suspicious/noExplicitAny: test
					property.title?.map((t: any) => t.plain_text || "").join(" ") || ""
				);

			case "rich_text":
				return (
					// biome-ignore lint/suspicious/noExplicitAny: test
					property.rich_text?.map((t: any) => t.plain_text || "").join(" ") ||
					""
				);

			case "select":
				return property.select?.name || "";

			case "multi_select":
				return (
					// biome-ignore lint/suspicious/noExplicitAny: test
					property.multi_select?.map((s: any) => s.name || "").join(" ") || ""
				);

			case "number":
				return property.number?.toString() || "";

			case "checkbox":
				return property.checkbox ? "checked" : "unchecked";

			case "url":
				return property.url || "";

			case "email":
				return property.email || "";

			case "phone_number":
				return property.phone_number || "";

			case "date":
				return property.date?.start || "";

			default:
				return "";
		}
	}
}
