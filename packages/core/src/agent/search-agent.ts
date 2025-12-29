// Search agent for natural language processing

import type { OpenAIClient } from "./openai-client.js";
import { OpenAIClientImpl } from "./openai-client.js";
import type { DateAnalysis, SearchQuery } from "./types.js";

export interface SearchAgent {
	processQuery(query: SearchQuery): Promise<SearchQuery>;
	extractSemanticMeaning(description: string): Promise<string[]>;
	parseDate(dateInput: string): Promise<Date | null>;
}

export class SearchAgentImpl implements SearchAgent {
	private openaiClient: OpenAIClient;

	constructor(openaiClient?: OpenAIClient) {
		this.openaiClient = openaiClient || new OpenAIClientImpl();
	}

	async processQuery(query: SearchQuery): Promise<SearchQuery> {
		// Process the natural language input and enhance the query
		const processedQuery = { ...query };

		// Extract semantic meaning from the description
		const semanticKeywords = await this.extractSemanticMeaning(
			query.description,
		);

		// If we extracted meaningful keywords, enhance the description
		if (semanticKeywords.length > 0) {
			// Store original description and add semantic context
			processedQuery.description = this.enhanceDescription(
				query.description,
				semanticKeywords,
			);
		}

		// Parse relative date if provided
		if (query.relativeDate) {
			const parsedDate = await this.parseDate(query.relativeDate);
			if (parsedDate) {
				// Store the parsed date information in the query for later use
				// We'll add this to the query context without modifying the interface
				(processedQuery as any).parsedTargetDate = parsedDate;
			}
		}

		// Set default values if not provided
		processedQuery.maxResults = processedQuery.maxResults || 10;
		processedQuery.includeContent = processedQuery.includeContent ?? true;

		return processedQuery;
	}

	async extractSemanticMeaning(description: string): Promise<string[]> {
		if (!description || description.trim().length === 0) {
			return [];
		}

		try {
			// Use OpenAI to extract semantic keywords and concepts
			// Create a mock search query for the semantic analysis
			const mockQuery: SearchQuery = {
				description: `Extract key concepts and semantic keywords from: "${description}"`,
				userId: "semantic-analysis",
				databaseId: "semantic-analysis",
			};

			const results = await this.openaiClient.searchDocuments(mockQuery);

			// Parse the AI response to extract keywords
			// In a real implementation, this would be more sophisticated
			const keywords = this.parseSemanticKeywords(description, results);

			return keywords;
		} catch (error) {
			console.error("Error extracting semantic meaning:", error);

			// Fallback: extract basic keywords using simple text processing
			return this.extractBasicKeywords(description);
		}
	}

	async parseDate(dateInput: string): Promise<Date | null> {
		if (!dateInput || dateInput.trim().length === 0) {
			return null;
		}

		try {
			// Use OpenAI for sophisticated date parsing
			const dateAnalysis: DateAnalysis =
				await this.openaiClient.analyzeDate(dateInput);

			// Validate the parsed date
			if (
				dateAnalysis.targetDate &&
				this.isValidDate(dateAnalysis.targetDate)
			) {
				return dateAnalysis.targetDate;
			}

			// Fallback to basic date parsing if AI analysis fails
			return this.parseBasicDate(dateInput);
		} catch (error) {
			console.error("Error parsing date with AI:", error);

			// Fallback to basic date parsing
			return this.parseBasicDate(dateInput);
		}
	}

	private enhanceDescription(
		originalDescription: string,
		keywords: string[],
	): string {
		// Combine original description with extracted semantic keywords
		// This helps improve search relevance
		const keywordString = keywords.join(" ");
		return `${originalDescription} [Keywords: ${keywordString}]`;
	}

	private parseSemanticKeywords(
		description: string,
		aiResults: any[],
	): string[] {
		// Extract keywords from AI response
		// This is a simplified implementation - in practice, this would be more sophisticated
		const keywords: string[] = [];

		// Extract nouns and important terms from the description
		const words = description.toLowerCase().split(/\s+/);
		const importantWords = words.filter(
			(word) =>
				word.length > 3 && !this.isStopWord(word) && /^[a-zA-Z]+$/.test(word),
		);

		keywords.push(...importantWords);

		// Add task-related keywords based on common patterns
		if (
			description.toLowerCase().includes("bug") ||
			description.toLowerCase().includes("fix")
		) {
			keywords.push("bug", "fix", "issue");
		}

		if (
			description.toLowerCase().includes("feature") ||
			description.toLowerCase().includes("implement")
		) {
			keywords.push("feature", "implementation", "development");
		}

		if (
			description.toLowerCase().includes("test") ||
			description.toLowerCase().includes("testing")
		) {
			keywords.push("test", "testing", "qa");
		}

		// Remove duplicates and return
		return [...new Set(keywords)];
	}

	private extractBasicKeywords(description: string): string[] {
		// Simple keyword extraction as fallback
		const words = description
			.toLowerCase()
			.replace(/[^\w\s]/g, " ")
			.split(/\s+/)
			.filter((word) => word.length > 2 && !this.isStopWord(word));

		return [...new Set(words)];
	}

	private isStopWord(word: string): boolean {
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

		return stopWords.has(word.toLowerCase());
	}

	private parseBasicDate(dateInput: string): Date | null {
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

		// Handle "X weeks ago" pattern
		const weeksAgoMatch = lowerInput.match(/(\d+)\s+weeks?\s+ago/);
		if (weeksAgoMatch) {
			const weeks = parseInt(weeksAgoMatch[1], 10);
			const date = new Date(now);
			date.setDate(now.getDate() - weeks * 7);
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

		// Handle "last month" pattern
		if (lowerInput === "last month") {
			const date = new Date(now);
			date.setMonth(now.getMonth() - 1);
			return date;
		}

		// Handle "this month" pattern
		if (lowerInput === "this month") {
			return now;
		}

		// Try to parse as ISO date string
		try {
			const parsed = new Date(dateInput);
			if (this.isValidDate(parsed)) {
				return parsed;
			}
		} catch {
			// Ignore parsing errors
		}

		// If we can't parse it, return null
		return null;
	}

	private isValidDate(date: Date): boolean {
		return date instanceof Date && !isNaN(date.getTime());
	}
}
