// Core types for the task search agent

import type { NotionPage } from "@notion-task-manager/notion";

export interface SearchQuery {
	description: string;
	userId: string;
	databaseId: string;
	targetDate?: Date;
	maxResults?: number;
}

export interface SearchResult {
	page: NotionPage;
	relevanceScore: number;
	reasoning: string;
}

export interface TaskSearchResult {
	results: SearchResult[];
	totalCount: number;
	searchTime: number;
	query: SearchQuery;
}
