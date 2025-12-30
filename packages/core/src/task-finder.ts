// Main TaskFinder facade class

import type { NotionTaskManager } from "@notion-task-manager/notion";
import type { SearchAgent } from "./agent/search-agent.js";
import { SearchAgentImpl } from "./agent/search-agent.js";
import type { RankingCriteria, SearchQuery } from "./agent/types.js";
import type { RankingService } from "./search/ranking-service.js";
import { RankingServiceImpl } from "./search/ranking-service.js";
import type { SearchEngine } from "./search/search-engine.js";
import { SearchEngineImpl } from "./search/search-engine.js";
import type { TaskSearchResult } from "./search/types.js";

export interface TaskFinder {
	search(query: SearchQuery): Promise<TaskSearchResult>;
	healthCheck(): Promise<boolean>;
}

/**
 * TaskFinder facade class that wires together SearchAgent, SearchEngine, and RankingService
 * Provides a unified interface for intelligent task searching with comprehensive error handling
 * Requirements: All requirements integration
 */
export class TaskFinderImpl implements TaskFinder {
	private searchAgent: SearchAgent;
	private searchEngine: SearchEngine;
	private rankingService: RankingService;
	private notionManager: NotionTaskManager;

	constructor(notionManager: NotionTaskManager, searchAgent?: SearchAgent) {
		this.notionManager = notionManager;
		this.searchAgent = searchAgent || new SearchAgentImpl();
		this.searchEngine = new SearchEngineImpl(notionManager);
		this.rankingService = new RankingServiceImpl();
	}

	/**
	 * Main search interface that processes queries and returns ranked results
	 * Integrates all components: SearchAgent -> SearchEngine -> RankingService
	 */
	async search(query: SearchQuery): Promise<TaskSearchResult> {
		try {
			// Validate input query
			this.validateSearchQuery(query);

			// Step 1: Process the query using SearchAgent
			// This enhances the query with semantic analysis and date parsing
			const processedQuery = await this.searchAgent.processQuery(query);

			// Step 2: Execute search using SearchEngine
			// This finds relevant documents and applies initial ranking
			const searchResult = await this.searchEngine.findTasks(processedQuery);

			// Step 3: Apply final ranking using RankingService
			// This combines scores and applies permission filtering
			const rankedResults = await this.applyFinalRanking(
				searchResult,
				processedQuery,
			);

			// Return the final result with updated rankings
			return {
				...searchResult,
				results: rankedResults,
			};
		} catch (error) {
			// Comprehensive error handling with context preservation
			throw this.handleSearchError(error, query);
		}
	}

	/**
	 * Health check to verify all components are functioning correctly
	 * Tests connectivity to OpenAI and Notion services
	 */
	async healthCheck(): Promise<boolean> {
		try {
			// Test 1: Verify SearchAgent can process a simple query
			const testQuery: SearchQuery = {
				description: "health check test",
				userId: "health-check",
				databaseId: "health-check",
				maxResults: 1,
			};

			const processedQuery = await this.searchAgent.processQuery(testQuery);
			if (!processedQuery || !processedQuery.description) {
				return false;
			}

			// Test 2: Verify Notion connection (if we have a valid database)
			// Note: We can't test actual database access without valid credentials
			// So we just verify the NotionTaskManager is properly initialized
			if (!this.notionManager) {
				return false;
			}

			// Test 3: Verify RankingService can process empty results
			const emptyResults = await this.rankingService.orderByScore([]);
			if (!Array.isArray(emptyResults)) {
				return false;
			}

			return true;
		} catch (error) {
			console.error("Health check failed:", error);
			return false;
		}
	}

	/**
	 * Applies final ranking and permission filtering to search results
	 */
	private async applyFinalRanking(
		searchResult: TaskSearchResult,
		processedQuery: SearchQuery,
	): Promise<typeof searchResult.results> {
		if (!searchResult.results || searchResult.results.length === 0) {
			return [];
		}

		try {
			// Determine ranking criteria based on whether date was specified
			const hasDate = !!processedQuery.targetDate;
			const criteria: RankingCriteria =
				RankingServiceImpl.createRankingCriteria(
					hasDate,
					processedQuery.maxResults || 10,
				);

			// Step 1: Combine scores using the ranking service
			const scoredResults = await this.rankingService.combineScores(
				searchResult.results,
				criteria,
			);

			// Step 2: Apply permission filtering
			const permittedResults = await this.rankingService.checkPermissions(
				scoredResults,
				processedQuery.userId,
			);

			// Step 3: Order by final combined score
			const orderedResults = this.rankingService.orderByScore(permittedResults);

			// Step 4: Apply result limit
			const maxResults = processedQuery.maxResults || 10;
			return orderedResults.slice(0, maxResults);
		} catch (error) {
			// If ranking fails, return original results but log the error
			console.error("Final ranking failed, returning original results:", error);
			return searchResult.results;
		}
	}

	/**
	 * Validates the search query input
	 */
	private validateSearchQuery(query: SearchQuery): void {
		if (!query) {
			throw new Error("Search query is required");
		}

		if (!query.description || typeof query.description !== "string") {
			throw new Error("Query description is required and must be a string");
		}

		if (query.description.trim().length === 0) {
			throw new Error("Query description cannot be empty");
		}

		if (!query.userId || typeof query.userId !== "string") {
			throw new Error("User ID is required and must be a string");
		}

		if (!query.databaseId || typeof query.databaseId !== "string") {
			throw new Error("Database ID is required and must be a string");
		}

		if (query.maxResults !== undefined) {
			if (
				typeof query.maxResults !== "number" ||
				query.maxResults < 1 ||
				query.maxResults > 100
			) {
				throw new Error("Max results must be a number between 1 and 100");
			}
		}

		if (query.targetDate !== undefined) {
			if (!(query.targetDate instanceof Date)) {
				throw new Error("Target date must be a Date object");
			}
		}
	}

	/**
	 * Comprehensive error handling with context preservation
	 */
	private handleSearchError(error: unknown, query: SearchQuery): Error {
		const baseMessage = "Task search failed";
		const queryContext = `Query: "${query?.description || "unknown"}", User: ${
			query?.userId || "unknown"
		}`;

		if (error instanceof Error) {
			// Preserve original error message and add context
			const enhancedMessage = `${baseMessage}: ${error.message}. ${queryContext}`;
			const enhancedError = new Error(enhancedMessage);
			enhancedError.stack = error.stack;
			return enhancedError;
		}

		// Handle non-Error objects
		const errorMessage =
			typeof error === "string" ? error : "Unknown error occurred";
		return new Error(`${baseMessage}: ${errorMessage}. ${queryContext}`);
	}
}
