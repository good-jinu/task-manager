// Search engine type definitions

import type { RankedResult, SearchQuery } from "../agent/types.js";

export interface TaskSearchResult {
	results: RankedResult[];
	totalCount: number;
	searchTime: number;
	query: SearchQuery;
	metadata: SearchMetadata;
}

export interface SearchMetadata {
	openaiTokensUsed: number;
	notionApiCalls: number;
	cacheHits: number;
	processingSteps: string[];
}

export interface ScoredResult {
	page: unknown; // Will be typed with Notion page type
	relevanceScore: number;
}
