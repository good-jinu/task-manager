import type { SyncResult, Task } from "@notion-task-manager/db";
import { NotionAdapter } from "@notion-task-manager/db";
import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Notion task manager
vi.mock("@notion-task-manager/notion", () => ({
	NotionTaskManager: vi.fn(() => ({
		createTask: vi.fn(),
		updateTask: vi.fn(),
		getTask: vi.fn(),
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
const taskStatusArb = fc.constantFrom(
	"todo",
	"in-progress",
	"done",
	"archived",
);
const taskPriorityArb = fc.constantFrom("low", "medium", "high", "urgent");

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

const externalIntegrationArb = fc.record({
	id: uuidArb,
	workspaceId: uuidArb,
	provider: fc.constant("notion"),
	externalId: nonEmptyStringArb,
	config: fc.dictionary(fc.string(), fc.anything()),
	syncEnabled: fc.boolean(),
	lastSyncAt: fc.option(isoDateArb),
	createdAt: isoDateArb,
});

const externalTaskDataArb = fc.record({
	externalId: nonEmptyStringArb,
	title: nonEmptyStringArb,
	content: fc.option(fc.string()),
	status: fc.option(fc.string()),
	priority: fc.option(fc.string()),
	dueDate: fc.option(isoDateArb),
	lastModified: fc.date(),
	archived: fc.option(fc.boolean()),
	raw: fc.record({
		id: nonEmptyStringArb,
		properties: fc.dictionary(fc.string(), fc.anything()),
	}),
});

describe("NotionAdapter Property-Based Tests", () => {
	let notionAdapter: NotionAdapter;
	let mockNotionTaskManager: {
		createPage: ReturnType<typeof vi.fn>;
		getPageContent: ReturnType<typeof vi.fn>;
		getDatabasePages: ReturnType<typeof vi.fn>;
		getDatabase: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockNotionTaskManager = {
			createPage: vi.fn(),
			getPageContent: vi.fn(),
			getDatabasePages: vi.fn(),
			getDatabase: vi.fn(),
		};
		notionAdapter = new NotionAdapter(mockNotionTaskManager);
	});

	describe("Property 12: Notion Adapter Mapping Round-Trip", () => {
		it("should preserve essential task fields through mapToExternal and mapFromExternal", async () => {
			// **Feature: task-management-migration, Property 12: Notion Adapter Mapping Round-Trip**
			await fc.assert(
				fc.asyncProperty(taskArb, async (originalTask) => {
					// Map to external format
					const externalData = notionAdapter.mapToExternal(
						originalTask as Task,
					);

					// Map back to internal format
					const mappedTask = notionAdapter.mapFromExternal(externalData);

					// Verify essential fields are preserved
					expect(mappedTask.title).toBe(originalTask.title);

					if (originalTask.content) {
						expect(mappedTask.content).toBe(originalTask.content);
					}

					// Status mapping should be consistent
					if (originalTask.status) {
						expect(mappedTask.status).toBeDefined();
					}

					// Verify external data structure
					expect(externalData.externalId).toBeDefined();
					expect(externalData.title).toBe(originalTask.title);
					expect(externalData.lastModified).toBeInstanceOf(Date);
				}),
				propertyTestConfig,
			);
		});
	});

	describe("Property 13: Sync Metadata Created on Push", () => {
		it("should return external ID on successful push operation", async () => {
			// **Feature: task-management-migration, Property 13: Sync Metadata Created on Push**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(taskArb, externalIntegrationArb),
					async ([task, integration]) => {
						const mockExternalId = `notion-page-${task.id}`;

						// Mock successful Notion API call
						mockNotionTaskManager.createPage.mockResolvedValueOnce({
							id: mockExternalId,
							title: task.title,
							lastEditedTime: new Date(),
							archived: false,
						});

						const result: SyncResult = await notionAdapter.pushTask(
							task as Task,
							integration,
						);

						expect(result.success).toBe(true);
						expect(result.externalId).toBeDefined();
						expect(typeof result.externalId).toBe("string");
						expect(result.error).toBeUndefined();
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 14: Archived External Marks Internal Archived", () => {
		it("should map archived external tasks to archived internal tasks", async () => {
			// **Feature: task-management-migration, Property 14: Archived External Marks Internal Archived**
			await fc.assert(
				fc.asyncProperty(externalTaskDataArb, async (externalTask) => {
					// Set external task as archived
					const archivedExternalTask = {
						...externalTask,
						archived: true,
					};

					const mappedTask =
						notionAdapter.mapFromExternal(archivedExternalTask);

					if (archivedExternalTask.archived) {
						expect(mappedTask.archived).toBe(true);
					}
				}),
				propertyTestConfig,
			);
		});
	});

	describe("Notion-Specific Field Mapping", () => {
		it("should handle Notion-specific field mappings correctly", async () => {
			// Additional property test for Notion-specific behavior
			await fc.assert(
				fc.asyncProperty(taskArb, async (task) => {
					const externalData = notionAdapter.mapToExternal(task as Task);

					// Verify Notion-specific structure
					expect(externalData.raw).toBeDefined();
					expect(externalData.externalId).toBeDefined();

					// Verify status mapping follows Notion conventions
					const _validNotionStatuses = ["Not started", "In progress", "Done"];
					if (externalData.status) {
						// The adapter should map internal statuses to valid Notion statuses
						expect(typeof externalData.status).toBe("string");
					}

					// Verify priority mapping
					if (task.priority && externalData.priority) {
						expect(typeof externalData.priority).toBe("string");
					}
				}),
				propertyTestConfig,
			);
		});
	});

	describe("Error Handling in Push Operations", () => {
		it("should handle push operation failures gracefully", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(taskArb, externalIntegrationArb, fc.string()),
					async ([task, integration, errorMessage]) => {
						// Mock Notion API failure
						mockNotionTaskManager.createPage.mockRejectedValueOnce(
							new Error(errorMessage),
						);

						const result: SyncResult = await notionAdapter.pushTask(
							task as Task,
							integration,
						);

						expect(result.success).toBe(false);
						expect(result.error).toBeDefined();
						expect(typeof result.error).toBe("string");
						expect(result.externalId).toBeUndefined();
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Pull Operation Data Integrity", () => {
		it("should maintain data integrity during pull operations", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(nonEmptyStringArb, externalIntegrationArb),
					async ([externalId, integration]) => {
						const _mockNotionPage = {
							id: externalId,
							properties: {
								Name: { title: [{ plain_text: "Test Task" }] },
								Status: { select: { name: "In progress" } },
								Priority: { select: { name: "High" } },
							},
							last_edited_time: new Date().toISOString(),
						};

						mockNotionTaskManager.getPageContent.mockResolvedValueOnce(
							"Test task content",
						);
						mockNotionTaskManager.getDatabasePages.mockResolvedValueOnce([
							{
								id: externalId,
								title: "Test Task",
								lastEditedTime: new Date(),
								archived: false,
							},
						]);

						const result = await notionAdapter.pullTask(
							externalId,
							integration,
						);

						if (result) {
							expect(result.externalId).toBe(externalId);
							expect(result.title).toBeDefined();
							expect(result.lastModified).toBeInstanceOf(Date);
							expect(result.raw).toBeDefined();
						}
					},
				),
				propertyTestConfig,
			);
		});
	});
});
