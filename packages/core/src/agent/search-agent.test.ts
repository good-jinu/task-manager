// Tests for SearchAgent implementation

import { describe, expect, it, vi } from "vitest";
import type { OpenAIClient } from "./openai-client.js";
import { SearchAgentImpl } from "./search-agent.js";
import type { DateAnalysis, SearchQuery } from "./types.js";

// Mock OpenAI client for testing
const createMockOpenAIClient = (): OpenAIClient => ({
	searchDocuments: vi.fn(),
	analyzeDate: vi.fn(),
	rankResults: vi.fn(),
	extractKeywords: vi.fn(),
	selectRelevantDocuments: vi.fn(),
});

describe("SearchAgent", () => {
	describe("processQuery", () => {
		it("should process a basic query and set defaults", async () => {
			const mockClient = createMockOpenAIClient();
			vi.mocked(mockClient.searchDocuments).mockResolvedValue([]);

			const agent = new SearchAgentImpl(mockClient);

			const query: SearchQuery = {
				description: "find bug reports",
				userId: "user1",
				databaseId: "db1",
			};

			const result = await agent.processQuery(query);

			expect(result.description).toContain("find bug reports");
			expect(result.maxResults).toBe(10);
			expect(result.includeContent).toBe(true);
		});

		it("should enhance description with semantic keywords", async () => {
			const mockClient = createMockOpenAIClient();
			vi.mocked(mockClient.extractKeywords).mockResolvedValue(
				"debug, problem, broken",
			);

			const agent = new SearchAgentImpl(mockClient);

			const query: SearchQuery = {
				description: "fix authentication bug",
				userId: "user1",
				databaseId: "db1",
			};

			const result = await agent.processQuery(query);

			expect(result.description).toContain("fix authentication bug");
			expect(result.description).toContain("debug");
			expect(result.description).toContain("problem");
		});

		it("should handle targetDate when provided", async () => {
			const mockClient = createMockOpenAIClient();
			const agent = new SearchAgentImpl(mockClient);

			const targetDate = new Date("2023-12-01");
			const query: SearchQuery = {
				description: "find tasks",
				targetDate: targetDate,
				userId: "user1",
				databaseId: "db1",
			};

			const result = await agent.processQuery(query);

			expect(result.targetDate).toEqual(targetDate);
		});
	});

	describe("extractSemanticMeaning", () => {
		it("should extract keywords from description", async () => {
			const mockClient = createMockOpenAIClient();
			vi.mocked(mockClient.searchDocuments).mockResolvedValue([]);

			const agent = new SearchAgentImpl(mockClient);

			const keywords = await agent.extractSemanticMeaning(
				"fix authentication bug in login system",
			);

			expect(keywords).toContain("authentication");
			expect(keywords).toContain("login");
			expect(keywords).toContain("system");
			expect(keywords).toContain("bug");
			expect(keywords).toContain("fix");
		});

		it("should return empty array for empty description", async () => {
			const mockClient = createMockOpenAIClient();
			const agent = new SearchAgentImpl(mockClient);

			const keywords = await agent.extractSemanticMeaning("");

			expect(keywords).toEqual([]);
		});

		it("should handle API errors gracefully", async () => {
			const mockClient = createMockOpenAIClient();
			vi.mocked(mockClient.searchDocuments).mockRejectedValue(
				new Error("API Error"),
			);

			const agent = new SearchAgentImpl(mockClient);

			const keywords = await agent.extractSemanticMeaning("test description");

			// Should fallback to basic keyword extraction
			expect(keywords).toContain("test");
			expect(keywords).toContain("description");
		});
	});

	describe("parseDate", () => {
		it("should parse common relative dates", async () => {
			const mockClient = createMockOpenAIClient();
			const agent = new SearchAgentImpl(mockClient);

			const today = await agent.parseDate("today");
			const yesterday = await agent.parseDate("yesterday");
			const lastWeek = await agent.parseDate("last week");

			expect(today).toBeInstanceOf(Date);
			expect(yesterday).toBeInstanceOf(Date);
			expect(lastWeek).toBeInstanceOf(Date);
		});

		it("should parse 'X days ago' pattern", async () => {
			const mockClient = createMockOpenAIClient();
			const agent = new SearchAgentImpl(mockClient);

			const threeDaysAgo = await agent.parseDate("3 days ago");
			const now = new Date();
			const expected = new Date(now);
			expected.setDate(now.getDate() - 3);

			expect(threeDaysAgo).toBeInstanceOf(Date);
			expect(threeDaysAgo?.getDate()).toBe(expected.getDate());
		});

		it("should return null for empty input", async () => {
			const mockClient = createMockOpenAIClient();
			const agent = new SearchAgentImpl(mockClient);

			const result = await agent.parseDate("");

			expect(result).toBeNull();
		});

		it("should return null for unparseable input", async () => {
			const mockClient = createMockOpenAIClient();
			const agent = new SearchAgentImpl(mockClient);

			const result = await agent.parseDate("invalid date string xyz");

			expect(result).toBeNull();
		});

		it("should use AI analysis when available", async () => {
			const mockClient = createMockOpenAIClient();
			const mockDateAnalysis: DateAnalysis = {
				targetDate: new Date("2023-11-15"),
				confidence: 0.8,
				interpretation: "mid November",
			};
			vi.mocked(mockClient.analyzeDate).mockResolvedValue(mockDateAnalysis);

			const agent = new SearchAgentImpl(mockClient);

			const result = await agent.parseDate("mid November");

			expect(result).toEqual(new Date("2023-11-15"));
		});

		it("should fallback to basic parsing when AI fails", async () => {
			const mockClient = createMockOpenAIClient();
			vi.mocked(mockClient.analyzeDate).mockRejectedValue(
				new Error("AI Error"),
			);

			const agent = new SearchAgentImpl(mockClient);

			const result = await agent.parseDate("yesterday");

			expect(result).toBeInstanceOf(Date);
		});
	});
});
