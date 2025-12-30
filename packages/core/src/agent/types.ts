// Agent-related type definitions

import type { NotionPage } from "@notion-task-manager/notion";

export interface SearchQuery {
	description: string;
	targetDate?: Date;
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
	page: NotionPage;
	relevanceScore: number;
	dateProximityScore: number;
	combinedScore: number;
}
