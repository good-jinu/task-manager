import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskService } from "../task-service";
import type { CreateTaskInput, Task } from "../types";

// Mock the DynamoDB client
vi.mock("../client", () => ({
	getDynamoDBClient: vi.fn(() => ({
		send: vi.fn(),
	})),
	getTableNames: vi.fn(() => ({
		tasks: "test-tasks-table",
	})),
}));

// Property test configuration
const propertyTestConfig = {
	numRuns: 100,
	verbose: true,
	seed: Date.now(),
};

// Generators for property-based testing
const taskStatusArb = fc.constantFrom(
	"todo",
	"in-progress",
	"done",
	"archived",
);
const taskPriorityArb = fc.constantFrom("low", "medium", "high", "urgent");
const uuidArb = fc.uuid();
// Use valid date range to avoid invalid ISO strings
const isoDateArb = fc
	.date({ min: new Date("2000-01-01"), max: new Date("2100-01-01") })
	.map((d) => d.toISOString());
// Generate non-empty strings that are not just whitespace (validation requires trimmed non-empty)
const nonEmptyStringArb = fc
	.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\s]{0,98}[a-zA-Z0-9]?$/)
	.filter((s) => s.trim().length > 0);

const createTaskInputArb = fc
	.record({
		workspaceId: uuidArb,
		title: nonEmptyStringArb,
		content: fc.option(fc.string({ maxLength: 1000 })),
		status: fc.option(taskStatusArb),
		priority: fc.option(taskPriorityArb),
		dueDate: fc.option(isoDateArb),
	})
	.map((input) => {
		// Filter out null values to create valid input
		const filtered: Record<string, unknown> = {
			workspaceId: input.workspaceId,
			title: input.title,
		};
		if (input.content !== null) filtered.content = input.content;
		if (input.status !== null) filtered.status = input.status;
		if (input.priority !== null) filtered.priority = input.priority;
		if (input.dueDate !== null) filtered.dueDate = input.dueDate;
		return filtered as typeof input;
	});

// Valid update input - only include defined values with valid types
const updateTaskInputArb = fc
	.record(
		{
			title: fc.option(nonEmptyStringArb),
			content: fc.option(fc.string({ maxLength: 1000 })),
			status: fc.option(taskStatusArb),
			priority: fc.option(taskPriorityArb),
			dueDate: fc.option(isoDateArb),
		},
		{ requiredKeys: [] },
	)
	.map((input) => {
		// Filter out null/undefined values to avoid validation issues
		const filtered: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input)) {
			if (value !== null && value !== undefined) {
				filtered[key] = value;
			}
		}
		return filtered;
	});

const taskArb = fc.record({
	id: uuidArb,
	workspaceId: uuidArb,
	title: nonEmptyStringArb,
	content: fc.option(fc.string({ maxLength: 1000 })),
	status: taskStatusArb,
	priority: fc.option(taskPriorityArb),
	dueDate: fc.option(isoDateArb),
	archived: fc.boolean(),
	createdAt: isoDateArb,
	updatedAt: isoDateArb,
});

describe("TaskService Property-Based Tests", () => {
	let taskService: TaskService;
	let mockClient: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		taskService = new TaskService();
		mockClient = (
			taskService as unknown as { client: ReturnType<typeof vi.fn> }
		).client;
	});

	describe("Property 1: Task Field Completeness", () => {
		it("should create tasks with all required fields for any valid CreateTaskInput", async () => {
			// **Feature: task-management-migration, Property 1: Task Field Completeness**
			await fc.assert(
				fc.asyncProperty(createTaskInputArb, async (input) => {
					// Mock successful DynamoDB put
					mockClient.send.mockResolvedValueOnce({});

					const result = await taskService.createTask(input);

					// Verify all required fields are present
					expect(result).toHaveProperty("id");
					expect(result).toHaveProperty("workspaceId", input.workspaceId);
					expect(result).toHaveProperty("title", input.title);
					expect(result).toHaveProperty("status");
					expect(result).toHaveProperty("archived", false);
					expect(result).toHaveProperty("createdAt");
					expect(result).toHaveProperty("updatedAt");

					// Verify field types and values
					expect(typeof result.id).toBe("string");
					expect(result.id).toMatch(
						/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
					);
					expect(typeof result.createdAt).toBe("string");
					expect(typeof result.updatedAt).toBe("string");
					expect(new Date(result.createdAt)).toBeInstanceOf(Date);
					expect(new Date(result.updatedAt)).toBeInstanceOf(Date);
				}),
				propertyTestConfig,
			);
		});
	});

	describe("Property 2: Entity Creation Generates UUID and Timestamps", () => {
		it("should generate unique UUID and equal timestamps for any task creation", async () => {
			// **Feature: task-management-migration, Property 2: Entity Creation Generates UUID and Timestamps**
			await fc.assert(
				fc.asyncProperty(createTaskInputArb, async (input) => {
					mockClient.send.mockResolvedValueOnce({});

					const result = await taskService.createTask(input);

					// Verify UUID format
					expect(result.id).toMatch(
						/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
					);

					// Verify timestamps are equal on creation
					expect(result.createdAt).toBe(result.updatedAt);

					// Verify timestamps are valid ISO strings
					expect(() => new Date(result.createdAt)).not.toThrow();
					expect(() => new Date(result.updatedAt)).not.toThrow();
				}),
				propertyTestConfig,
			);
		});
	});

	describe("Property 3: Update Changes updatedAt", () => {
		it("should update updatedAt while preserving createdAt for any task update", async () => {
			// **Feature: task-management-migration, Property 3: Update Changes updatedAt**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(uuidArb, updateTaskInputArb),
					async ([taskId, updateInput]) => {
						// Skip if no actual updates provided
						if (
							Object.keys(updateInput).length === 0 ||
							Object.values(updateInput).every((v) => v === undefined)
						) {
							return;
						}

						const originalCreatedAt = "2023-01-01T00:00:00.000Z";
						const originalUpdatedAt = "2023-01-01T00:00:00.000Z";

						// Mock successful update with new updatedAt
						const mockUpdatedTask = {
							id: taskId,
							workspaceId: "test-workspace",
							title: updateInput.title || "Test Task",
							status: updateInput.status || "todo",
							archived: false,
							createdAt: originalCreatedAt,
							updatedAt: new Date().toISOString(),
							...updateInput,
						};

						mockClient.send.mockResolvedValueOnce({
							Attributes: mockUpdatedTask,
						});

						const result = await taskService.updateTask(taskId, updateInput);

						// Verify createdAt is unchanged
						expect(result.createdAt).toBe(originalCreatedAt);

						// Verify updatedAt is greater than or equal to original
						expect(new Date(result.updatedAt).getTime()).toBeGreaterThanOrEqual(
							new Date(originalUpdatedAt).getTime(),
						);
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 4: Query by Workspace Returns Correct Tasks", () => {
		it("should return only tasks belonging to the specified workspace", async () => {
			// **Feature: task-management-migration, Property 4: Query by Workspace Returns Correct Tasks**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // target workspace
						fc.array(taskArb, { minLength: 0, maxLength: 10 }), // tasks
					),
					async ([targetWorkspaceId, allTasks]) => {
						// Filter tasks that should be returned
						const expectedTasks = allTasks.filter(
							(task) => task.workspaceId === targetWorkspaceId,
						);

						mockClient.send.mockResolvedValueOnce({
							Items: expectedTasks,
							LastEvaluatedKey: undefined,
						});

						const result = await taskService.listTasks(targetWorkspaceId);

						// Verify all returned tasks belong to the target workspace
						expect(result.items).toHaveLength(expectedTasks.length);
						result.items.forEach((task) => {
							expect(task.workspaceId).toBe(targetWorkspaceId);
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 5: Query by Status Filters Correctly", () => {
		it("should return only tasks with the specified status", async () => {
			// **Feature: task-management-migration, Property 5: Query by Status Filters Correctly**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						taskStatusArb, // target status
						fc.array(taskArb, { minLength: 0, maxLength: 10 }), // tasks
					),
					async ([workspaceId, targetStatus, allTasks]) => {
						// Filter tasks that should be returned
						const expectedTasks = allTasks.filter(
							(task) =>
								task.workspaceId === workspaceId &&
								task.status === targetStatus,
						);

						mockClient.send.mockResolvedValueOnce({
							Items: expectedTasks,
							LastEvaluatedKey: undefined,
						});

						const result = await taskService.listTasksByStatus(
							workspaceId,
							targetStatus,
						);

						// Verify all returned tasks have the target status
						expect(result.items).toHaveLength(expectedTasks.length);
						result.items.forEach((task) => {
							expect(task.status).toBe(targetStatus);
							expect(task.workspaceId).toBe(workspaceId);
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 26: Task Validation on Create", () => {
		it("should validate required fields on task creation", async () => {
			// **Feature: task-management-migration, Property 26: Task Validation on Create**
			await fc.assert(
				fc.asyncProperty(
					fc
						.record({
							workspaceId: fc.option(uuidArb),
							title: fc.option(nonEmptyStringArb),
							content: fc.option(fc.string()),
							status: taskStatusArb, // Status is required and must be valid
							priority: taskPriorityArb, // Priority must be valid when provided
							dueDate: fc.option(isoDateArb),
						})
						.map((input) => {
							// Filter out null values to create valid input
							const filtered: Record<string, unknown> = {};
							if (input.workspaceId !== null)
								filtered.workspaceId = input.workspaceId;
							if (input.title !== null) filtered.title = input.title;
							if (input.content !== null) filtered.content = input.content;
							filtered.status = input.status;
							filtered.priority = input.priority;
							if (input.dueDate !== null) filtered.dueDate = input.dueDate;
							return filtered;
						}),
					async (input) => {
						const hasRequiredFields = input.workspaceId && input.title;

						if (hasRequiredFields) {
							mockClient.send.mockResolvedValueOnce({});

							const result = await taskService.createTask(
								input as CreateTaskInput,
							);
							expect(result).toBeDefined();
							expect(result.workspaceId).toBe(input.workspaceId);
							expect(result.title).toBe(input.title);
						} else {
							// Should throw validation error for missing required fields
							await expect(
								taskService.createTask(input as CreateTaskInput),
							).rejects.toThrow();
						}
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 27: Task Retrieval Returns Task or Null", () => {
		it("should return task if exists or null if not found", async () => {
			// **Feature: task-management-migration, Property 27: Task Retrieval Returns Task or Null**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(uuidArb, fc.boolean()),
					async ([taskId, exists]) => {
						if (exists) {
							const mockTask: Task = {
								id: taskId,
								workspaceId: "test-workspace",
								title: "Test Task",
								status: "todo",
								archived: false,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							};

							mockClient.send.mockResolvedValueOnce({
								Item: mockTask,
							});

							const result = await taskService.getTask(taskId);
							expect(result).toEqual(mockTask);
						} else {
							mockClient.send.mockResolvedValueOnce({
								Item: undefined,
							});

							const result = await taskService.getTask(taskId);
							expect(result).toBeNull();
						}
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 30: Task Pagination", () => {
		it("should respect pagination limits and return correct number of tasks", async () => {
			// **Feature: task-management-migration, Property 30: Task Pagination**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						fc.integer({ min: 1, max: 100 }), // limit
						fc.array(taskArb, { minLength: 0, maxLength: 200 }), // all tasks
					),
					async ([workspaceId, limit, allTasks]) => {
						const workspaceTasks = allTasks.filter(
							(task) => task.workspaceId === workspaceId,
						);
						const expectedItems = workspaceTasks.slice(0, limit);
						const hasMore = workspaceTasks.length > limit;

						mockClient.send.mockResolvedValueOnce({
							Items: expectedItems,
							LastEvaluatedKey: hasMore ? { id: "cursor" } : undefined,
						});

						const result = await taskService.listTasks(workspaceId, { limit });

						// Verify pagination constraints
						expect(result.items.length).toBeLessThanOrEqual(limit);
						expect(result.hasMore).toBe(hasMore);

						if (hasMore) {
							expect(result.nextCursor).toBeDefined();
						} else {
							expect(result.nextCursor).toBeUndefined();
						}
					},
				),
				propertyTestConfig,
			);
		});
	});
});
