// Agent-related type definitions

export interface SearchQuery {
	description: string;
	relativeDate?: string;
	userId: string;
	databaseId: string;
	maxResults?: number;
	includeContent?: boolean;
}

export interface SearchResult {
	pageId: string;
	title: string;
	relevanceScore: number;
	createdTime: Date;
	content?: string;
}

export interface DateAnalysis {
	targetDate: Date;
	confidence: number;
	interpretation: string;
}

export interface RankingCriteria {
	semanticWeight: number;
	dateWeight: number;
	maxResults: number;
}

export interface RankedResult {
	page: unknown; // Will be typed with Notion page type
	relevanceScore: number;
	dateProximityScore: number;
	combinedScore: number;
}
