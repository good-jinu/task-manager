// TaskFinder facade class tests

import type { NotionTaskManager } from "@notion-task-manager/notion";
import { describe, expect, it, vi } from "vitest";
import type { SearchAgent } from "./agent/search-agent.js";
import type { SearchQuery } from "./agent/types.js";
import { TaskFinderImpl } from "./task-finder.js";

describe("TaskFinder", () => {
	const mockNotionManager = {
		getDatabasePages: vi.fn(),
	} as unknown as NotionTaskManager;

	const mockSearchAgent: SearchAgent = {
		processQuery: vi.fn(),
		extractSemanticMeaning: vi.fn(),
		parseDate: vi.fn(),
	};

	describe("constructor", () => {
		it("should accept optional SearchAgent", () => {
			const taskFinder = new TaskFinderImpl(mockNotionManager, mockSearchAgent);
			expect(taskFinder).toBeInstanceOf(TaskFinderImpl);
		});
	});

	describe("search", () => {
		it("should validate required query fields", async () => {
			const taskFinder = new TaskFinderImpl(mockNotionManager, mockSearchAgent);

			// Test missing query
			await expect(taskFinder.search(null as any)).rejects.toThrow(
				"Task search failed: Search query is required",
			);

			// Test missing description
			await expect(
				taskFinder.search({
					userId: "test",
					databaseId: "test",
				} as SearchQuery),
			).rejects.toThrow(
				"Task search failed: Query description is required and must be a string",
			);

			// Test empty description (this will be caught by the trim check)
			await expect(
				taskFinder.search({
					description: "   ", // whitespace only
					userId: "test",
					databaseId: "test",
				}),
			).rejects.toThrow(
				"Task search failed: Query description cannot be empty",
			);

			// Test missing userId
			await expect(
				taskFinder.search({
					description: "test",
					databaseId: "test",
				} as SearchQuery),
			).rejects.toThrow("Task search failed: User ID is required");

			// Test missing databaseId
			await expect(
				taskFinder.search({
					description: "test",
					userId: "test",
				} as SearchQuery),
			).rejects.toThrow("Task search failed: Database ID is required");
		});

		it("should validate maxResults range", async () => {
			const taskFinder = new TaskFinderImpl(mockNotionManager, mockSearchAgent);

			await expect(
				taskFinder.search({
					description: "test",
					userId: "test",
					databaseId: "test",
					maxResults: 0,
				}),
			).rejects.toThrow(
				"Task search failed: Max results must be a number between 1 and 100",
			);

			await expect(
				taskFinder.search({
					description: "test",
					userId: "test",
					databaseId: "test",
					maxResults: 101,
				}),
			).rejects.toThrow(
				"Task search failed: Max results must be a number between 1 and 100",
			);
		});

		it("should handle search errors gracefully", async () => {
			const mockAgent: SearchAgent = {
				processQuery: vi.fn().mockRejectedValue(new Error("Agent error")),
				extractSemanticMeaning: vi.fn(),
				parseDate: vi.fn(),
			};

			const taskFinder = new TaskFinderImpl(mockNotionManager, mockAgent);

			const query: SearchQuery = {
				description: "test query",
				userId: "test-user",
				databaseId: "test-db",
			};

			await expect(taskFinder.search(query)).rejects.toThrow(
				'Task search failed: Agent error. Query: "test query", User: test-user',
			);
		});
	});

	describe("healthCheck", () => {
		it("should return true for successful health check", async () => {
			const mockAgent: SearchAgent = {
				processQuery: vi.fn().mockResolvedValue({
					description: "health check test",
					userId: "health-check",
					databaseId: "health-check",
				}),
				extractSemanticMeaning: vi.fn(),
				parseDate: vi.fn(),
			};

			const taskFinder = new TaskFinderImpl(mockNotionManager, mockAgent);
			const result = await taskFinder.healthCheck();
			expect(result).toBe(true);
		});

		it("should return false when SearchAgent fails", async () => {
			const mockAgent: SearchAgent = {
				processQuery: vi.fn().mockRejectedValue(new Error("Agent failure")),
				extractSemanticMeaning: vi.fn(),
				parseDate: vi.fn(),
			};

			const taskFinder = new TaskFinderImpl(mockNotionManager, mockAgent);
			const result = await taskFinder.healthCheck();
			expect(result).toBe(false);
		});

		it("should return false when NotionTaskManager is missing", async () => {
			const mockAgent: SearchAgent = {
				processQuery: vi.fn().mockResolvedValue({
					description: "health check test",
					userId: "health-check",
					databaseId: "health-check",
				}),
				extractSemanticMeaning: vi.fn(),
				parseDate: vi.fn(),
			};

			const taskFinder = new TaskFinderImpl(null as any, mockAgent);
			const result = await taskFinder.healthCheck();
			expect(result).toBe(false);
		});
	});
});
