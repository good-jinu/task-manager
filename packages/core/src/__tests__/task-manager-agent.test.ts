import type { TaskService } from "@notion-task-manager/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskManagerAgent } from "../agent/task-manager-agent";

// Mock the LLM provider
vi.mock("../llm/provider", () => ({
	getModel: () => ({
		// Mock model that returns simple responses
	}),
}));

// Mock the AI SDK
vi.mock("ai", () => ({
	generateText: vi.fn(),
	stepCountIs: vi.fn(() => ({})),
}));

describe("TaskManagerAgent", () => {
	let agent: TaskManagerAgent;
	let mockTaskService: TaskService;

	beforeEach(() => {
		agent = new TaskManagerAgent();

		// Create a mock task service
		mockTaskService = {
			createTask: vi.fn(),
			getTask: vi.fn(),
			updateTask: vi.fn(),
			deleteTask: vi.fn(),
			listTasks: vi.fn(),
			listTasksByStatus: vi.fn(),
		} as unknown as TaskService;
	});

	it("should be instantiated correctly", () => {
		expect(agent).toBeInstanceOf(TaskManagerAgent);
	});

	it("should have the correct interface for execute method", () => {
		expect(typeof agent.execute).toBe("function");
	});

	it("should handle execution parameters correctly", async () => {
		// Mock the generateText function to return a simple response
		const { generateText } = await import("ai");
		vi.mocked(generateText).mockResolvedValue({
			text: "Task processed successfully",
			toolCalls: [],
			toolResults: [],
			usage: {} as any,
			response: {} as any,
		} as any);

		const params = {
			userId: "test-user",
			executionId: "test-execution",
			workspaceId: "test-workspace",
			query: "Create a test task",
			taskService: mockTaskService,
		};

		const result = await agent.execute(params);

		expect(result).toHaveProperty("action");
		expect(result).toHaveProperty("message");
		expect(result).toHaveProperty("reasoning");
		expect(typeof result.action).toBe("string");
		expect(typeof result.message).toBe("string");
		expect(typeof result.reasoning).toBe("string");
	});

	it("should handle errors gracefully", async () => {
		// Mock the generateText function to throw an error
		const { generateText } = await import("ai");
		vi.mocked(generateText).mockRejectedValue(new Error("Test error"));

		const params = {
			userId: "test-user",
			executionId: "test-execution",
			workspaceId: "test-workspace",
			query: "Create a test task",
			taskService: mockTaskService,
		};

		const result = await agent.execute(params);

		expect(result.action).toBe("none");
		expect(result.message).toContain("Failed to process task");
		expect(result.reasoning).toContain("Failed to process task");
	});
});
