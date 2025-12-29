// Unit tests for RankingService

import type { NotionPage } from "@notion-task-manager/notion";
import { describe, expect, it } from "vitest";
import type { RankedResult, RankingCriteria } from "../agent/types.js";
import { RankingServiceImpl } from "./ranking-service.js";

describe("RankingService", () => {
	const rankingService = new RankingServiceImpl();

	// Mock NotionPage data
	const createMockPage = (id: string, title: string): NotionPage => ({
		id,
		title,
		url: `https://notion.so/${id}`,
		createdTime: new Date("2024-01-01"),
		lastEditedTime: new Date("2024-01-01"),
		properties: {},
	});

	const createMockResult = (
		pageId: string,
		title: string,
		relevanceScore: number,
		dateProximityScore: number,
	): RankedResult => ({
		page: createMockPage(pageId, title),
		relevanceScore,
		dateProximityScore,
		combinedScore: 0, // Will be calculated by combineScores
	});

	describe("combineScores", () => {
		it("should combine scores with proper weighting when date is specified", async () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 0.8, 0.6),
				createMockResult("2", "Task 2", 0.6, 0.9),
			];

			const criteria: RankingCriteria = {
				semanticWeight: 0.3,
				dateWeight: 0.7,
				maxResults: 10,
			};

			const combinedResults = await rankingService.combineScores(
				results,
				criteria,
			);

			expect(combinedResults).toHaveLength(2);

			// Task 1: 0.8 * 0.3 + 0.6 * 0.7 = 0.24 + 0.42 = 0.66
			expect(combinedResults[0].combinedScore).toBeCloseTo(0.66, 2);

			// Task 2: 0.6 * 0.3 + 0.9 * 0.7 = 0.18 + 0.63 = 0.81
			expect(combinedResults[1].combinedScore).toBeCloseTo(0.81, 2);
		});

		it("should use only semantic relevance when date weight is zero", async () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 0.8, 0.6),
			];

			const criteria: RankingCriteria = {
				semanticWeight: 1.0,
				dateWeight: 0.0,
				maxResults: 10,
			};

			const combinedResults = await rankingService.combineScores(
				results,
				criteria,
			);

			expect(combinedResults[0].combinedScore).toBe(0.8);
		});

		it("should handle empty results", async () => {
			const criteria: RankingCriteria = {
				semanticWeight: 0.5,
				dateWeight: 0.5,
				maxResults: 10,
			};

			const combinedResults = await rankingService.combineScores([], criteria);

			expect(combinedResults).toHaveLength(0);
		});

		it("should clamp scores to valid range [0, 1]", async () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 1.5, -0.2), // Invalid scores
			];

			const criteria: RankingCriteria = {
				semanticWeight: 0.5,
				dateWeight: 0.5,
				maxResults: 10,
			};

			const combinedResults = await rankingService.combineScores(
				results,
				criteria,
			);

			expect(combinedResults[0].relevanceScore).toBe(1.0); // Clamped to 1.0
			expect(combinedResults[0].dateProximityScore).toBe(0.0); // Clamped to 0.0
			expect(combinedResults[0].combinedScore).toBe(0.5); // 1.0 * 0.5 + 0.0 * 0.5
		});
	});

	describe("orderByScore", () => {
		it("should order results by combined score in descending order", () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 0.6, 0.5),
				createMockResult("2", "Task 2", 0.9, 0.8),
				createMockResult("3", "Task 3", 0.7, 0.6),
			];

			// Set combined scores manually for testing
			results[0].combinedScore = 0.55;
			results[1].combinedScore = 0.85;
			results[2].combinedScore = 0.65;

			const orderedResults = rankingService.orderByScore(results);

			expect(orderedResults).toHaveLength(3);
			expect(orderedResults[0].page.id).toBe("2"); // Highest score (0.85)
			expect(orderedResults[1].page.id).toBe("3"); // Middle score (0.65)
			expect(orderedResults[2].page.id).toBe("1"); // Lowest score (0.55)
		});

		it("should use relevance score as tiebreaker for equal combined scores", () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 0.6, 0.5),
				createMockResult("2", "Task 2", 0.8, 0.3),
			];

			// Set equal combined scores
			results[0].combinedScore = 0.7;
			results[1].combinedScore = 0.7;

			const orderedResults = rankingService.orderByScore(results);

			expect(orderedResults[0].page.id).toBe("2"); // Higher relevance score (0.8)
			expect(orderedResults[1].page.id).toBe("1"); // Lower relevance score (0.6)
		});

		it("should handle empty results", () => {
			const orderedResults = rankingService.orderByScore([]);
			expect(orderedResults).toHaveLength(0);
		});

		it("should not mutate original array", () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 0.6, 0.5),
				createMockResult("2", "Task 2", 0.9, 0.8),
			];

			results[0].combinedScore = 0.9;
			results[1].combinedScore = 0.6;

			const originalOrder = results.map((r) => r.page.id);
			const orderedResults = rankingService.orderByScore(results);

			// Original array should be unchanged
			expect(results.map((r) => r.page.id)).toEqual(originalOrder);
			// New array should be ordered
			expect(orderedResults.map((r) => r.page.id)).toEqual(["1", "2"]);
		});
	});

	describe("checkPermissions", () => {
		it("should filter out invalid pages", async () => {
			const results: RankedResult[] = [
				createMockResult("1", "Valid Task", 0.8, 0.6),
				{
					// Invalid page (no id)
					page: {
						title: "Invalid",
						url: "https://notion.so/invalid",
						createdTime: new Date(),
						lastEditedTime: new Date(),
						properties: {},
					} as NotionPage,
					relevanceScore: 0.7,
					dateProximityScore: 0.5,
					combinedScore: 0.6,
				},
			];

			const filteredResults = await rankingService.checkPermissions(
				results,
				"user123",
			);

			expect(filteredResults).toHaveLength(1);
			expect(filteredResults[0].page.id).toBe("1");
		});

		it("should filter out archived pages", async () => {
			const results: RankedResult[] = [
				createMockResult("1", "Active Task", 0.8, 0.6),
				{
					page: {
						...createMockPage("2", "Archived Task"),
						archived: true,
					} as NotionPage,
					relevanceScore: 0.7,
					dateProximityScore: 0.5,
					combinedScore: 0.6,
				},
			];

			const filteredResults = await rankingService.checkPermissions(
				results,
				"user123",
			);

			expect(filteredResults).toHaveLength(1);
			expect(filteredResults[0].page.id).toBe("1");
		});

		it("should throw error for invalid userId", async () => {
			const results: RankedResult[] = [
				createMockResult("1", "Task 1", 0.8, 0.6),
			];

			await expect(
				rankingService.checkPermissions(results, ""),
			).rejects.toThrow("Valid userId is required");

			await expect(
				rankingService.checkPermissions(results, "   "),
			).rejects.toThrow("Valid userId is required");
		});

		it("should handle empty results", async () => {
			const filteredResults = await rankingService.checkPermissions(
				[],
				"user123",
			);

			expect(filteredResults).toHaveLength(0);
		});
	});

	describe("createRankingCriteria", () => {
		it("should create criteria with date weighting when hasDate is true", () => {
			const criteria = RankingServiceImpl.createRankingCriteria(true, 5);

			expect(criteria.semanticWeight).toBe(0.3);
			expect(criteria.dateWeight).toBe(0.7);
			expect(criteria.maxResults).toBe(5);
		});

		it("should create criteria with semantic-only weighting when hasDate is false", () => {
			const criteria = RankingServiceImpl.createRankingCriteria(false, 10);

			expect(criteria.semanticWeight).toBe(1.0);
			expect(criteria.dateWeight).toBe(0.0);
			expect(criteria.maxResults).toBe(10);
		});

		it("should use default maxResults when not specified", () => {
			const criteria = RankingServiceImpl.createRankingCriteria(true);

			expect(criteria.maxResults).toBe(10);
		});
	});
});
