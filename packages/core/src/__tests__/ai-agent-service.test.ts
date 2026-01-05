import type { Task } from "@notion-task-manager/db";
import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AIAgentService,
	ParsedTask,
	TaskRecommendation,
	TaskSuggestion,
} from "../ai-agent-service";
import { createAIAgentService } from "../ai-agent-service";

// Mock the AI module
vi.mock("ai", () => ({
	generateObject: vi.fn(),
	generateText: vi.fn(),
}));

import { generateObject, generateText } from "ai";

// Mock AI SDK
vi.mock("ai", () => ({
	generateObject: vi.fn(),
	generateText: vi.fn(),
}));

// Mock task service - use the main package export
vi.mock("@notion-task-manager/db", () => ({
	TaskService: vi.fn(() => ({
		listTasks: vi.fn(),
	})),
}));

// Property test configuration
const propertyTestConfig = {
	numRuns: 100,
	verbose: true,
	seed: Date.now(),
};

// Generators for property-based testing
const uuidArb = fc.uuid();
const isoDateArb = fc.date().map((d) => d.toISOString());
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 });
const naturalLanguageInputArb = fc.oneof(
	fc.constant("Buy groceries tomorrow"),
	fc.constant("Schedule meeting with team next week"),
	fc.constant("Fix the bug in the login system urgently"),
	fc.constant("Review the quarterly report by Friday"),
	fc.constant("Call mom this evening"),
	fc.string({ minLength: 5, maxLength: 200 }),
);

const taskArb = fc.record({
	id: uuidArb,
	workspaceId: uuidArb,
	title: nonEmptyStringArb,
	content: fc.option(fc.string()),
	status: fc.constantFrom("todo", "in-progress", "done", "archived"),
	priority: fc.option(fc.constantFrom("low", "medium", "high", "urgent")),
	dueDate: fc.option(isoDateArb),
	archived: fc.boolean(),
	createdAt: isoDateArb,
	updatedAt: isoDateArb,
});

describe("AIAgentService Property-Based Tests", () => {
	let aiAgentService: AIAgentService;
	let mockGenerateObject: ReturnType<typeof vi.fn>;
	let _mockGenerateText: ReturnType<typeof vi.fn>;
	let mockTaskService: {
		listTasks: ReturnType<typeof vi.fn>;
		createTask: ReturnType<typeof vi.fn>;
		updateTask: ReturnType<typeof vi.fn>;
		deleteTask: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockGenerateObject = vi.mocked(generateObject);
		_mockGenerateText = vi.mocked(generateText);

		mockTaskService = {
			listTasks: vi.fn(),
			createTask: vi.fn(),
			updateTask: vi.fn(),
			deleteTask: vi.fn(),
		};

		aiAgentService = createAIAgentService();
	});

	describe("Property 38: AI Task Parsing", () => {
		it("should parse natural language input into structured task fields with confidence > 0.7", async () => {
			// **Feature: task-management-migration, Property 38: AI Task Parsing**
			await fc.assert(
				fc.asyncProperty(naturalLanguageInputArb, async (input) => {
					// Mock AI response with high confidence
					const mockParsedTask: ParsedTask = {
						title: "Parsed Task Title",
						content: "Parsed task description",
						priority: "medium",
						dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
						confidence: 0.85, // Above 0.7 threshold
					};

					mockGenerateObject.mockResolvedValueOnce({
						object: mockParsedTask,
					});

					const result = await aiAgentService.parseNaturalLanguageTask(input);

					// Verify confidence threshold
					expect(result.confidence).toBeGreaterThan(0.7);

					// Verify structured fields are present
					expect(result.title).toBeDefined();
					expect(typeof result.title).toBe("string");
					expect(result.title.length).toBeGreaterThan(0);

					// Verify confidence is a valid number
					expect(typeof result.confidence).toBe("number");
					expect(result.confidence).toBeGreaterThanOrEqual(0);
					expect(result.confidence).toBeLessThanOrEqual(1);

					// Verify optional fields have correct types when present
					if (result.content) {
						expect(typeof result.content).toBe("string");
					}
					if (result.priority) {
						expect(["low", "medium", "high", "urgent"]).toContain(
							result.priority,
						);
					}
					if (result.dueDate) {
						expect(() => new Date(result.dueDate)).not.toThrow();
					}
				}),
				propertyTestConfig,
			);
		});
	});

	describe("AI Task Suggestions", () => {
		it("should generate relevant task suggestions based on workspace context", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						fc.option(nonEmptyStringArb), // context
						fc.array(taskArb, { minLength: 0, maxLength: 10 }), // existing tasks
					),
					async ([workspaceId, context, existingTasks]) => {
						// Mock existing tasks
						mockTaskService.listTasks.mockResolvedValueOnce({
							items: existingTasks,
							hasMore: false,
						});

						// Mock AI suggestions
						const mockSuggestions: TaskSuggestion[] = [
							{
								title: "Suggested Task 1",
								content: "Description for task 1",
								priority: "medium",
								estimatedDuration: "30 minutes",
								reasoning: "Based on your recent tasks",
							},
							{
								title: "Suggested Task 2",
								priority: "high",
								estimatedDuration: "1 hour",
								reasoning: "This complements your current work",
							},
						];

						mockGenerateObject.mockResolvedValueOnce({
							object: { suggestions: mockSuggestions },
						});

						const result = await aiAgentService.generateTaskSuggestions(
							workspaceId,
							context,
						);

						// Verify suggestions structure
						expect(Array.isArray(result)).toBe(true);
						result.forEach((suggestion) => {
							expect(suggestion.title).toBeDefined();
							expect(typeof suggestion.title).toBe("string");
							expect(suggestion.reasoning).toBeDefined();
							expect(typeof suggestion.reasoning).toBe("string");

							if (suggestion.priority) {
								expect(["low", "medium", "high", "urgent"]).toContain(
									suggestion.priority,
								);
							}
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("AI Task Queries", () => {
		it("should process natural language queries and return relevant tasks", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						fc.oneof(
							fc.constant("show me overdue tasks"),
							fc.constant("what should I work on next"),
							fc.constant("find high priority tasks"),
							fc.constant("tasks due this week"),
						), // query
						fc.array(taskArb, { minLength: 0, maxLength: 15 }), // all tasks
					),
					async ([workspaceId, query, allTasks]) => {
						// Mock task retrieval
						mockTaskService.listTasks.mockResolvedValueOnce({
							items: allTasks,
							hasMore: false,
						});

						// Mock AI query processing
						const relevantTasks = allTasks.slice(
							0,
							Math.min(5, allTasks.length),
						);
						mockGenerateObject.mockResolvedValueOnce({
							object: { taskIds: relevantTasks.map((t) => t.id) },
						});

						const result = await aiAgentService.queryTasks(workspaceId, query);

						// Verify result is array of tasks
						expect(Array.isArray(result)).toBe(true);

						// Verify all returned tasks exist in the original set
						result.forEach((task) => {
							expect(allTasks.some((t) => t.id === task.id)).toBe(true);
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("AI Task Recommendations", () => {
		it("should provide task recommendations with reasoning and urgency scores", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						uuidArb, // user ID
						fc.array(taskArb, { minLength: 1, maxLength: 10 }), // tasks
					),
					async ([workspaceId, userId, tasks]) => {
						// Mock task retrieval
						mockTaskService.listTasks.mockResolvedValueOnce({
							items: tasks,
							hasMore: false,
						});

						// Mock AI recommendations
						const mockRecommendations: TaskRecommendation[] = (tasks as Task[])
							.slice(0, 3)
							.map((task, index) => ({
								task,
								reason: `Recommendation reason ${index + 1}`,
								urgencyScore: Math.random() * 10,
							}));

						mockGenerateObject.mockResolvedValueOnce({
							object: { recommendations: mockRecommendations },
						});

						const result = await aiAgentService.getTaskRecommendations(
							workspaceId,
							userId,
						);

						// Verify recommendations structure
						expect(Array.isArray(result)).toBe(true);
						result.forEach((recommendation) => {
							expect(recommendation.task).toBeDefined();
							expect(recommendation.reason).toBeDefined();
							expect(typeof recommendation.reason).toBe("string");
							expect(typeof recommendation.urgencyScore).toBe("number");
							expect(recommendation.urgencyScore).toBeGreaterThanOrEqual(0);
							expect(recommendation.urgencyScore).toBeLessThanOrEqual(10);
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("AI Parsing Edge Cases", () => {
		it("should handle low confidence parsing gracefully", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.string({ minLength: 1, maxLength: 10 }), // ambiguous input
					async (ambiguousInput) => {
						// Mock low confidence response
						const mockLowConfidenceTask: ParsedTask = {
							title: ambiguousInput,
							confidence: 0.3, // Below 0.7 threshold
						};

						mockGenerateObject.mockResolvedValueOnce({
							object: mockLowConfidenceTask,
						});

						const result =
							await aiAgentService.parseNaturalLanguageTask(ambiguousInput);

						// Should still return a result but with low confidence
						expect(result.confidence).toBeLessThan(0.7);
						expect(result.title).toBeDefined();

						// Low confidence results should be handled appropriately by the caller
						if (result.confidence < 0.7) {
							// The service should indicate uncertainty
							expect(typeof result.confidence).toBe("number");
						}
					},
				),
				propertyTestConfig,
			);
		});
	});
});
