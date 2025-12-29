// OpenAI client wrapper for intelligent task search

import OpenAI from "openai";
import { EnvironmentConfig } from "../config/environment.js";
import {
	type PromptManager,
	PromptManagerImpl,
} from "../prompt/search-prompts.js";
import { PromptType } from "../prompt/types.js";
import type {
	DateAnalysis,
	RankedResult,
	RankingCriteria,
	SearchQuery,
	SearchResult,
} from "./types.js";

export interface OpenAIClient {
	searchDocuments(query: SearchQuery): Promise<SearchResult[]>;
	analyzeDate(dateInput: string): Promise<DateAnalysis>;
	rankResults(
		results: SearchResult[],
		criteria: RankingCriteria,
	): Promise<RankedResult[]>;
}

export class OpenAIClientImpl implements OpenAIClient {
	private openai: OpenAI;
	private promptManager: PromptManager;
	private conversationHistory: Map<
		string,
		OpenAI.Chat.ChatCompletionMessageParam[]
	> = new Map();
	private retryAttempts = 3;
	private retryDelay = 1000; // 1 second base delay

	constructor() {
		const config = EnvironmentConfig.getOpenAIConfig();

		this.openai = new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
		});

		this.promptManager = new PromptManagerImpl();
	}

	async searchDocuments(query: SearchQuery): Promise<SearchResult[]> {
		try {
			// Get the semantic search prompt template
			const promptTemplate = await this.promptManager.getSearchPrompt(
				PromptType.SEMANTIC_SEARCH,
			);

			// Format the prompt with the query
			const formattedPrompt = this.promptManager.formatPrompt(promptTemplate, {
				query: query.description,
			});

			// Get conversation context for this user
			const conversationKey = `${query.userId}-${query.databaseId}`;
			const messages = this.getConversationContext(conversationKey);

			// Add the current query to the conversation
			messages.push({
				role: "user",
				content: formattedPrompt,
			});

			// Make the API call with retry logic
			const response = await this.makeAPICallWithRetry(async () => {
				const config = EnvironmentConfig.getOpenAIConfig();
				return await this.openai.chat.completions.create({
					model: config.model,
					messages,
					max_tokens: config.maxTokens,
					temperature: config.temperature,
				});
			});

			// Update conversation history
			if (response.choices[0]?.message) {
				messages.push(response.choices[0].message);
				this.conversationHistory.set(conversationKey, messages);
			}

			// Parse the response and return search results
			// For now, return a mock result since we don't have actual Notion integration yet
			const mockResults: SearchResult[] = [
				{
					pageId: "mock-page-id",
					title: `Search result for: ${query.description}`,
					relevanceScore: 0.8,
					createdTime: new Date(),
					content:
						response.choices[0]?.message?.content || "No content available",
				},
			];

			return mockResults;
		} catch (error) {
			return this.handleAPIError(error, "searchDocuments");
		}
	}

	async analyzeDate(dateInput: string): Promise<DateAnalysis> {
		try {
			// Get the date analysis prompt template
			const promptTemplate = await this.promptManager.getSearchPrompt(
				PromptType.DATE_ANALYSIS,
			);

			// Format the prompt with the date input and current date
			const formattedPrompt = this.promptManager.formatPrompt(promptTemplate, {
				dateInput,
				currentDate: new Date().toISOString(),
			});

			// Make the API call with retry logic
			const response = await this.makeAPICallWithRetry(async () => {
				const config = EnvironmentConfig.getOpenAIConfig();
				return await this.openai.chat.completions.create({
					model: config.model,
					messages: [{ role: "user", content: formattedPrompt }],
					max_tokens: config.maxTokens,
					temperature: 0.1, // Lower temperature for more consistent date parsing
				});
			});

			// Parse the response to extract date analysis
			const content = response.choices[0]?.message?.content || "";

			// For now, implement basic date parsing logic
			// In a real implementation, this would parse the AI response more sophisticatedly
			const targetDate = this.parseRelativeDate(dateInput);

			return {
				targetDate,
				confidence: 0.8, // Mock confidence score
				interpretation:
					content ||
					`Interpreted "${dateInput}" as ${targetDate.toISOString()}`,
			};
		} catch (error) {
			return this.handleDateAnalysisError(error, dateInput);
		}
	}

	async rankResults(
		results: SearchResult[],
		criteria: RankingCriteria,
	): Promise<RankedResult[]> {
		try {
			// Get the result ranking prompt template
			const promptTemplate = await this.promptManager.getSearchPrompt(
				PromptType.RESULT_RANKING,
			);

			// Format the prompt with ranking criteria and results
			const formattedPrompt = this.promptManager.formatPrompt(promptTemplate, {
				query: "ranking query", // This would come from the original search query
				targetDate: new Date().toISOString(),
				dateWeight: criteria.dateWeight,
				results: JSON.stringify(
					results.map((r) => ({
						title: r.title,
						relevanceScore: r.relevanceScore,
						createdTime: r.createdTime,
					})),
				),
			});

			// Make the API call with retry logic
			const response = await this.makeAPICallWithRetry(async () => {
				const config = EnvironmentConfig.getOpenAIConfig();
				return await this.openai.chat.completions.create({
					model: config.model,
					messages: [{ role: "user", content: formattedPrompt }],
					max_tokens: config.maxTokens,
					temperature: 0.3, // Lower temperature for consistent ranking
				});
			});

			// Note: This is a mock implementation since we can't convert SearchResult to NotionPage
			// In the real implementation, the SearchEngine should handle ranking with proper NotionPage objects
			console.warn(
				"OpenAI client rankResults is deprecated - use SearchEngine instead",
			);

			// Return empty array since we can't properly convert SearchResult to RankedResult
			return [];
		} catch (error) {
			return this.handleRankingError(error, results).slice(
				0,
				criteria.maxResults,
			);
		}
	}

	private getConversationContext(
		conversationKey: string,
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		if (!this.conversationHistory.has(conversationKey)) {
			this.conversationHistory.set(conversationKey, []);
		}
		return this.conversationHistory.get(conversationKey)!;
	}

	private async makeAPICallWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
		let lastError: Error;

		for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
			try {
				return await apiCall();
			} catch (error) {
				lastError = error as Error;

				// Check if it's a rate limit error
				if (this.isRateLimitError(error)) {
					const delay = this.calculateRetryDelay(attempt);
					await this.sleep(delay);
					continue;
				}

				// For non-rate-limit errors, don't retry
				throw error;
			}
		}

		throw lastError!;
	}

	private isRateLimitError(error: any): boolean {
		return (
			error?.status === 429 ||
			error?.code === "rate_limit_exceeded" ||
			error?.message?.includes("rate limit")
		);
	}

	private calculateRetryDelay(attempt: number): number {
		// Exponential backoff: 1s, 2s, 4s
		return this.retryDelay * 2 ** (attempt - 1);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private handleAPIError(error: any, operation: string): SearchResult[] {
		console.error(`OpenAI API error in ${operation}:`, error);

		// Return fallback empty results
		return [];
	}

	private handleDateAnalysisError(error: any, dateInput: string): DateAnalysis {
		console.error("Date analysis error:", error);

		// Return fallback date analysis
		return {
			targetDate: new Date(),
			confidence: 0.1,
			interpretation: `Failed to analyze date "${dateInput}": ${error.message}`,
		};
	}

	private handleRankingError(
		error: any,
		results: SearchResult[],
	): RankedResult[] {
		console.error("Result ranking error:", error);

		// Return empty array since we can't convert SearchResult to RankedResult
		console.warn(
			"OpenAI client ranking error handler - use SearchEngine instead",
		);
		return [];
	}

	private parseRelativeDate(dateInput: string): Date {
		const now = new Date();
		const lowerInput = dateInput.toLowerCase().trim();

		// Handle common relative date patterns
		if (lowerInput === "today") {
			return now;
		}

		if (lowerInput === "yesterday") {
			const yesterday = new Date(now);
			yesterday.setDate(now.getDate() - 1);
			return yesterday;
		}

		if (lowerInput === "tomorrow") {
			const tomorrow = new Date(now);
			tomorrow.setDate(now.getDate() + 1);
			return tomorrow;
		}

		// Handle "X days ago" pattern
		const daysAgoMatch = lowerInput.match(/(\d+)\s+days?\s+ago/);
		if (daysAgoMatch) {
			const days = parseInt(daysAgoMatch[1], 10);
			const date = new Date(now);
			date.setDate(now.getDate() - days);
			return date;
		}

		// Handle "last week" pattern
		if (lowerInput === "last week") {
			const date = new Date(now);
			date.setDate(now.getDate() - 7);
			return date;
		}

		// Handle "this week" pattern
		if (lowerInput === "this week") {
			return now;
		}

		// Default: return current date if we can't parse
		return now;
	}

	// Method to clear conversation history (useful for testing)
	clearConversationHistory(): void {
		this.conversationHistory.clear();
	}
}
