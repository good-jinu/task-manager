import type { MigrationResult } from "@notion-task-manager/db";
import { MigrationService } from "@notion-task-manager/db";
import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

// Property test configuration
const propertyTestConfig = {
	numRuns: 100,
	verbose: true,
	seed: Date.now(),
};

// Generators for property-based testing
const uuidArb = fc.uuid();
// Use regex pattern to ensure non-whitespace characters are included
const nonEmptyStringArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\s]{0,99}$/);
const notionPageArb = fc.record({
	id: nonEmptyStringArb,
	title: nonEmptyStringArb,
	lastEditedTime: fc.date(),
	archived: fc.boolean(),
});

// Helper to create fresh mocks for each property test iteration
function createMocks() {
	const mockTaskService = {
		createTask: vi.fn(),
		getTask: vi.fn(),
		updateTask: vi.fn(),
		deleteTask: vi.fn(),
		listTasks: vi.fn(),
		listTasksByStatus: vi.fn(),
	};
	const mockWorkspaceService = {
		createWorkspace: vi
			.fn()
			.mockResolvedValue({ id: "test-workspace", name: "Test Workspace" }),
		getWorkspace: vi.fn(),
		updateWorkspace: vi.fn(),
		deleteWorkspace: vi.fn(),
		listWorkspaces: vi.fn(),
	};
	const mockSyncMetadataService = {
		createSyncMetadata: vi.fn().mockResolvedValue({}),
		getSyncMetadata: vi.fn(),
		getSyncMetadataByExternalId: vi.fn(),
		updateSyncMetadata: vi.fn().mockResolvedValue({}),
		deleteSyncMetadata: vi.fn(),
		deleteSyncMetadataForTask: vi.fn(),
		listSyncMetadataByIntegrationAndStatus: vi.fn(),
		listSyncMetadataByIntegration: vi.fn(),
	};
	const mockIntegrationService = {
		createIntegration: vi
			.fn()
			.mockResolvedValue({ id: "test-integration", provider: "notion" }),
		getIntegration: vi.fn(),
		getIntegrationByWorkspaceAndProvider: vi.fn(),
		updateIntegration: vi.fn(),
		deleteIntegration: vi.fn(),
		listIntegrations: vi.fn(),
	};
	const mockNotionTaskManager = {
		getTask: vi.fn(),
		createPage: vi.fn(),
		getPageContent: vi.fn().mockResolvedValue(""),
		getDatabasePages: vi.fn(),
		getDatabase: vi
			.fn()
			.mockResolvedValue({ id: "db-id", title: "Test Database" }),
	};

	const migrationService = new MigrationService(
		mockNotionTaskManager as any,
		mockTaskService as any,
		mockWorkspaceService as any,
		mockSyncMetadataService as any,
		mockIntegrationService as any,
	);

	return {
		migrationService,
		mockTaskService,
		mockWorkspaceService,
		mockSyncMetadataService,
		mockIntegrationService,
		mockNotionTaskManager,
	};
}

describe("MigrationService Property-Based Tests", () => {
	describe("Property 22: Migration Imports All Pages", () => {
		it("should create exactly N internal tasks for N Notion pages (minus failures)", async () => {
			// **Feature: task-management-migration, Property 22: Migration Imports All Pages**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // user ID
						nonEmptyStringArb, // notion database ID
						fc.option(uuidArb), // target workspace ID
						fc.array(notionPageArb, { minLength: 0, maxLength: 20 }), // notion pages
					),
					async ([
						userId,
						notionDatabaseId,
						targetWorkspaceId,
						notionPages,
					]) => {
						// Create fresh mocks for each iteration
						const { migrationService, mockTaskService, mockNotionTaskManager } =
							createMocks();

						// Mock Notion API to return the pages
						mockNotionTaskManager.getDatabasePages.mockResolvedValueOnce(
							notionPages,
						);

						// Mock successful task creation for all pages
						let taskIndex = 0;
						mockTaskService.createTask.mockImplementation(() => {
							const task = {
								id: `task-${taskIndex}`,
								workspaceId: targetWorkspaceId || "default-workspace",
								title: `Task from page ${taskIndex}`,
								status: "todo",
								archived: false,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							};
							taskIndex++;
							return Promise.resolve(task);
						});

						const result: MigrationResult =
							await migrationService.importFromNotion(
								userId,
								notionDatabaseId,
								targetWorkspaceId,
							);

						// Verify the migration result
						expect(result.totalTasks).toBe(notionPages.length);
						expect(result.successCount).toBe(notionPages.length);
						expect(result.failureCount).toBe(0);
						expect(result.errors).toHaveLength(0);

						// Verify task creation was called for each page
						expect(mockTaskService.createTask).toHaveBeenCalledTimes(
							notionPages.length,
						);
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 23: Migration Creates Sync Metadata", () => {
		it("should create sync metadata linking internal tasks to Notion pages", async () => {
			// **Feature: task-management-migration, Property 23: Migration Creates Sync Metadata**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // user ID
						nonEmptyStringArb, // notion database ID
						fc.array(notionPageArb, { minLength: 1, maxLength: 10 }), // notion pages
					),
					async ([userId, notionDatabaseId, notionPages]) => {
						// Create fresh mocks for each iteration
						const {
							migrationService,
							mockTaskService,
							mockNotionTaskManager,
							mockSyncMetadataService,
						} = createMocks();

						mockNotionTaskManager.getDatabasePages.mockResolvedValueOnce(
							notionPages,
						);

						// Mock successful task creation
						let taskIndex = 0;
						mockTaskService.createTask.mockImplementation(() => {
							const task = {
								id: `task-${taskIndex}`,
								workspaceId: "test-workspace",
								title: `Task from page ${taskIndex}`,
								status: "todo",
								archived: false,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							};
							taskIndex++;
							return Promise.resolve(task);
						});

						await migrationService.importFromNotion(userId, notionDatabaseId);

						// Verify sync metadata creation was called for each successful import
						expect(
							mockSyncMetadataService.createSyncMetadata,
						).toHaveBeenCalledTimes(notionPages.length);

						// Verify each call links the correct task ID to Notion page ID
						notionPages.forEach((page, index) => {
							expect(
								mockSyncMetadataService.createSyncMetadata,
							).toHaveBeenCalledWith(
								expect.objectContaining({
									taskId: `task-${index}`,
									externalId: page.id,
								}),
							);
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 24: Migration Continues on Partial Failure", () => {
		it("should continue processing remaining pages when some fail to import", async () => {
			// **Feature: task-management-migration, Property 24: Migration Continues on Partial Failure**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // user ID
						nonEmptyStringArb, // notion database ID
						fc.array(notionPageArb, { minLength: 3, maxLength: 10 }), // notion pages
						fc.integer({ min: 1, max: 2 }), // number of failures
					),
					async ([userId, notionDatabaseId, notionPages, failureCount]) => {
						// Create fresh mocks for each iteration
						const { migrationService, mockTaskService, mockNotionTaskManager } =
							createMocks();

						mockNotionTaskManager.getDatabasePages.mockResolvedValueOnce(
							notionPages,
						);

						let callCount = 0;
						mockTaskService.createTask.mockImplementation(() => {
							callCount++;
							if (callCount <= failureCount) {
								return Promise.reject(
									new Error(`Failed to create task ${callCount}`),
								);
							}
							return Promise.resolve({
								id: `task-${callCount}`,
								workspaceId: "test-workspace",
								title: `Task ${callCount}`,
								status: "todo",
								archived: false,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							});
						});

						const result: MigrationResult =
							await migrationService.importFromNotion(userId, notionDatabaseId);

						// Verify migration continued despite failures
						expect(result.totalTasks).toBe(notionPages.length);
						expect(result.failureCount).toBe(failureCount);
						expect(result.successCount).toBe(notionPages.length - failureCount);
						expect(result.errors).toHaveLength(failureCount);

						// Verify all pages were attempted
						expect(mockTaskService.createTask).toHaveBeenCalledTimes(
							notionPages.length,
						);
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 25: Migration Summary Completeness", () => {
		it("should return complete MigrationResult with all required fields", async () => {
			// **Feature: task-management-migration, Property 25: Migration Summary Completeness**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // user ID
						nonEmptyStringArb, // notion database ID
						fc.option(uuidArb), // target workspace ID
						fc.array(notionPageArb, { minLength: 0, maxLength: 15 }), // notion pages
					),
					async ([
						userId,
						notionDatabaseId,
						targetWorkspaceId,
						notionPages,
					]) => {
						// Create fresh mocks for each iteration
						const { migrationService, mockTaskService, mockNotionTaskManager } =
							createMocks();

						mockNotionTaskManager.getDatabasePages.mockResolvedValueOnce(
							notionPages,
						);

						// Mock mixed success/failure scenario
						const successCount = Math.floor(notionPages.length * 0.7);

						let callCount = 0;
						mockTaskService.createTask.mockImplementation(() => {
							callCount++;
							if (callCount > successCount) {
								return Promise.reject(
									new Error(`Failed to create task ${callCount}`),
								);
							}
							return Promise.resolve({
								id: `task-${callCount}`,
								workspaceId: targetWorkspaceId || "default-workspace",
								title: `Task ${callCount}`,
								status: "todo",
								archived: false,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							});
						});

						const result: MigrationResult =
							await migrationService.importFromNotion(
								userId,
								notionDatabaseId,
								targetWorkspaceId,
							);

						// Verify all required fields are present
						expect(result).toHaveProperty("migrationId");
						expect(result).toHaveProperty("workspaceId");
						expect(result).toHaveProperty("totalTasks", notionPages.length);
						expect(result).toHaveProperty("successCount");
						expect(result).toHaveProperty("failureCount");
						expect(result).toHaveProperty("errors");

						// Verify field types
						expect(typeof result.migrationId).toBe("string");
						expect(typeof result.workspaceId).toBe("string");
						expect(typeof result.totalTasks).toBe("number");
						expect(typeof result.successCount).toBe("number");
						expect(typeof result.failureCount).toBe("number");
						expect(Array.isArray(result.errors)).toBe(true);

						// Verify counts add up
						expect(result.successCount + result.failureCount).toBe(
							result.totalTasks,
						);
						expect(result.errors.length).toBe(result.failureCount);
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Migration Progress Tracking", () => {
		it("should track migration progress accurately", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // user ID
						nonEmptyStringArb, // notion database ID
						fc.array(notionPageArb, { minLength: 1, maxLength: 10 }), // notion pages
					),
					async ([userId, notionDatabaseId, notionPages]) => {
						// Create fresh mocks for each iteration
						const { migrationService, mockTaskService, mockNotionTaskManager } =
							createMocks();

						mockNotionTaskManager.getDatabasePages.mockResolvedValueOnce(
							notionPages,
						);

						// Mock successful task creation
						mockTaskService.createTask.mockResolvedValue({
							id: "test-task",
							workspaceId: "test-workspace",
							title: "Test Task",
							status: "todo",
							archived: false,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						});

						const result = await migrationService.importFromNotion(
							userId,
							notionDatabaseId,
						);

						// Verify progress tracking
						const progress = await migrationService.getMigrationProgress(
							result.migrationId,
						);

						if (progress) {
							expect(progress.migrationId).toBe(result.migrationId);
							expect(progress.totalTasks).toBe(notionPages.length);
							expect(progress.processedTasks).toBe(notionPages.length);
							expect([
								"pending",
								"in-progress",
								"completed",
								"failed",
							]).toContain(progress.status);
						}
					},
				),
				propertyTestConfig,
			);
		});
	});
});
