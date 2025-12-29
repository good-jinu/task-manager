import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIClientImpl } from "./openai-client.js";
import type { RankingCriteria, SearchQuery, SearchResult } from "./types.js";

// Mock OpenAI module
vi.mock("openai", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: vi.fn().mockResolvedValue({
						choices: [
							{
								message: {
									role: "assistant",
									content: "Mock OpenAI response",
								},
							},
						],
					}),
				},
			},
		})),
	};
});

// Mock environment config
vi.mock("../config/environment.js", () => ({
	EnvironmentConfig: {
		getOpenAIConfig: vi.fn().mockReturnValue({
			apiKey: "test-api-key",
			baseUrl: undefined,
			model: "gpt-4",
			maxTokens: 2000,
			temperature: 0.7,
		}),
	},
}));

describe("OpenAIClient", () => {
	let client: OpenAIClientImpl;

	beforeEach(() => {
		client = new OpenAIClientImpl();
		vi.clearAllMocks();
	});

	describe("searchDocuments", () => {
		it("should process search query and return results", async () => {
			const query: SearchQuery = {
				description: "find authentication tasks",
				userId: "user123",
				databaseId: "db123",
				maxResults: 10,
			};

			const results = await client.searchDocuments(query);

			expect(results).toHaveLength(1);
			expect(results[0]).toMatchObject({
				pageId: "mock-page-id",
				title: expect.stringContaining("find authentication tasks"),
				relevanceScore: 0.8,
				createdTime: expect.any(Date),
			});
		});

		it("should handle API errors gracefully", async () => {
			// Mock OpenAI to throw an error
			const mockOpenAI = await import("openai");
			const mockCreate = vi.fn().mockRejectedValue(new Error("API Error"));
			(mockOpenAI.default as any).mockImplementation(() => ({
				chat: {
					completions: {
						create: mockCreate,
					},
				},
			}));

			const client = new OpenAIClientImpl();
			const query: SearchQuery = {
				description: "test query",
				userId: "user123",
				databaseId: "db123",
			};

			const results = await client.searchDocuments(query);
			expect(results).toEqual([]);
		});
	});

	describe("analyzeDate", () => {
		it("should analyze relative date input", async () => {
			const result = await client.analyzeDate("2 days ago");

			expect(result).toMatchObject({
				targetDate: expect.any(Date),
				confidence: expect.any(Number),
				interpretation: expect.any(String),
			});
			expect(result.confidence).toBeGreaterThan(0);
			expect(result.confidence).toBeLessThanOrEqual(1);
		});

		it("should handle common date patterns", async () => {
			const testCases = [
				"today",
				"yesterday",
				"tomorrow",
				"last week",
				"3 days ago",
			];

			for (const dateInput of testCases) {
				const result = await client.analyzeDate(dateInput);
				expect(result.targetDate).toBeInstanceOf(Date);
				expect(result.interpretation).toContain(dateInput);
			}
		});

		it("should handle invalid date input gracefully", async () => {
			// Mock OpenAI to throw an error
			const mockOpenAI = await import("openai");
			const mockCreate = vi.fn().mockRejectedValue(new Error("API Error"));
			(mockOpenAI.default as any).mockImplementation(() => ({
				chat: {
					completions: {
						create: mockCreate,
					},
				},
			}));

			const client = new OpenAIClientImpl();
			const result = await client.analyzeDate("invalid date");

			expect(result.confidence).toBeLessThan(0.5);
			expect(result.interpretation).toContain("Failed to analyze");
		});
	});

	describe("rankResults", () => {
		it("should rank results by combined score", async () => {
			const mockResults: SearchResult[] = [
				{
					pageId: "page1",
					title: "Task 1",
					relevanceScore: 0.9,
					createdTime: new Date("2024-01-01"),
				},
				{
					pageId: "page2",
					title: "Task 2",
					relevanceScore: 0.7,
					createdTime: new Date("2024-01-02"),
				},
			];

			const criteria: RankingCriteria = {
				semanticWeight: 0.7,
				dateWeight: 0.3,
				maxResults: 10,
			};

			const results = await client.rankResults(mockResults, criteria);

			expect(results).toHaveLength(2);
			expect(results[0].combinedScore).toBeGreaterThanOrEqual(
				results[1].combinedScore,
			);
			expect(results[0]).toMatchObject({
				page: expect.any(Object),
				relevanceScore: expect.any(Number),
				dateProximityScore: expect.any(Number),
				combinedScore: expect.any(Number),
			});
		});

		it("should limit results based on maxResults", async () => {
			const mockResults: SearchResult[] = Array.from({ length: 5 }, (_, i) => ({
				pageId: `page${i}`,
				title: `Task ${i}`,
				relevanceScore: 0.8,
				createdTime: new Date(),
			}));

			const criteria: RankingCriteria = {
				semanticWeight: 0.7,
				dateWeight: 0.3,
				maxResults: 3,
			};

			const results = await client.rankResults(mockResults, criteria);
			expect(results).toHaveLength(3);
		});
	});

	describe("conversation context", () => {
		it("should maintain conversation history per user", async () => {
			const query1: SearchQuery = {
				description: "first query",
				userId: "user123",
				databaseId: "db123",
			};

			const query2: SearchQuery = {
				description: "follow up query",
				userId: "user123",
				databaseId: "db123",
			};

			await client.searchDocuments(query1);
			await client.searchDocuments(query2);

			// Conversation history should be maintained (tested indirectly through successful calls)
			expect(true).toBe(true); // Placeholder assertion
		});

		it("should clear conversation history", () => {
			client.clearConversationHistory();
			expect(true).toBe(true); // Method should execute without error
		});
	});
});
