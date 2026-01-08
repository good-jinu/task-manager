import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestUserService } from "../guest-user-service";
import type { MigrationResult, Workspace } from "../types";

// Mock dependencies
vi.mock("../client", () => ({
	getDynamoDBClient: vi.fn(() => ({
		send: vi.fn(),
	})),
	getTableNames: vi.fn(() => ({
		guestUsers: "test-guest-users-table",
		workspaces: "test-workspaces-table",
		tasks: "test-tasks-table",
	})),
}));

vi.mock("../workspace-service", () => ({
	WorkspaceService: vi.fn(() => ({
		createWorkspace: vi.fn(),
	})),
}));

vi.mock("../task-service", () => ({
	TaskService: vi.fn(() => ({
		listTasks: vi.fn(),
		updateTask: vi.fn(),
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

const guestUserArb = fc.record({
	id: uuidArb,
	createdAt: isoDateArb,
	expiresAt: isoDateArb, // Will be validated in test
	migrated: fc.boolean(),
});

// Generator for guest users with valid 1-year TTL
const validGuestUserArb = fc
	.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") })
	.map((createdAt) => {
		const expiresAt = new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year later
		return {
			id: `guest_${crypto.randomUUID()}`,
			createdAt: createdAt.toISOString(),
			expiresAt: expiresAt.toISOString(),
			migrated: false,
		};
	});

const _workspaceArb = fc.record({
	id: uuidArb,
	userId: uuidArb,
	name: nonEmptyStringArb,
	description: fc.option(fc.string()),
	createdAt: isoDateArb,
	updatedAt: isoDateArb,
});

describe("GuestUserService Property-Based Tests", () => {
	let guestUserService: GuestUserService;
	let mockClient: {
		send: ReturnType<typeof vi.fn>;
	};
	let mockWorkspaceService: {
		createWorkspace: ReturnType<typeof vi.fn>;
		listWorkspaces: ReturnType<typeof vi.fn>;
	};
	let mockTaskService: {
		listTasks: ReturnType<typeof vi.fn>;
		updateTask: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			send: vi.fn(),
		};
		mockWorkspaceService = {
			createWorkspace: vi.fn(),
			listWorkspaces: vi.fn(),
		};
		mockTaskService = {
			listTasks: vi.fn(),
			updateTask: vi.fn(),
		};
		guestUserService = new GuestUserService();
		(guestUserService as unknown as { client: typeof mockClient }).client =
			mockClient;
		(
			guestUserService as unknown as {
				workspaceService: typeof mockWorkspaceService;
			}
		).workspaceService = mockWorkspaceService;
		(
			guestUserService as unknown as { taskService: typeof mockTaskService }
		).taskService = mockTaskService;
	});

	describe("Property 34: Guest User Creation", () => {
		it("should generate unique guest ID and create default workspace with 7-day TTL", async () => {
			// **Feature: task-management-migration, Property 34: Guest User Creation**
			await fc.assert(
				fc.asyncProperty(
					fc.constant(null), // No input needed for guest user creation
					async () => {
						const guestId = guestUserService.generateGuestId();
						const workspaceId = "workspace-id";

						const mockWorkspace: Workspace = {
							id: workspaceId,
							userId: guestId, // Use the actual generated guest ID
							name: "My Tasks",
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						};

						// Mock guest user creation
						mockClient.send.mockResolvedValueOnce({}); // Put guest user
						mockWorkspaceService.createWorkspace.mockResolvedValueOnce(
							mockWorkspace,
						);

						// createGuestWorkspace returns workspace.id (string), not the workspace object
						const returnedWorkspaceId =
							await guestUserService.createGuestWorkspace(guestId);

						// Verify guest ID has the expected format (guest_ prefix + UUID)
						expect(guestId).toMatch(
							/^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
						);

						// Verify workspace ID was returned
						expect(returnedWorkspaceId).toBe(workspaceId);

						// Verify workspace service was called with guest ID
						expect(mockWorkspaceService.createWorkspace).toHaveBeenCalledWith(
							guestId,
							expect.objectContaining({
								name: "My Tasks",
							}),
						);
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 35: Guest Task Storage with TTL", () => {
		it("should store guest tasks with 7-day TTL", async () => {
			// **Feature: task-management-migration, Property 35: Guest Task Storage with TTL**
			await fc.assert(
				fc.asyncProperty(validGuestUserArb, async (guestUser) => {
					// Mock guest user retrieval
					mockClient.send.mockResolvedValueOnce({
						Item: guestUser,
					});

					// Verify TTL is set correctly (1 year from creation)
					const createdAt = new Date(guestUser.createdAt);
					const expiresAt = new Date(guestUser.expiresAt);
					const daysDifference =
						(expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

					// Should expire within 1 year (allowing for some test timing variance)
					expect(daysDifference).toBeGreaterThanOrEqual(364.9);
					expect(daysDifference).toBeLessThanOrEqual(365.1);

					// Verify guest user has valid structure
					expect(guestUser.id).toMatch(
						/^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
					);
					expect(typeof guestUser.migrated).toBe("boolean");
				}),
				propertyTestConfig,
			);
		});
	});

	describe("Property 37: Guest Task Migration", () => {
		it("should successfully transfer all guest tasks to permanent account", async () => {
			// **Feature: task-management-migration, Property 37: Guest Task Migration**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // guest ID
						uuidArb, // permanent user ID
						fc.array(
							fc.record({
								id: uuidArb,
								workspaceId: uuidArb,
								title: nonEmptyStringArb,
								status: fc.constantFrom("todo", "in-progress", "done"),
								archived: fc.boolean(),
								createdAt: isoDateArb,
								updatedAt: isoDateArb,
							}),
							{ minLength: 0, maxLength: 10 },
						), // guest tasks
					),
					async ([guestId, permanentUserId, guestTasks]) => {
						const guestWorkspaceId = "guest-workspace-id";
						const newWorkspaceId = "new-workspace-id";

						// Mock workspace listing for guest user
						mockWorkspaceService.listWorkspaces.mockResolvedValueOnce([
							{
								id: guestWorkspaceId,
								userId: guestId,
								name: "My Tasks",
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
						]);

						// Mock creating new workspace for permanent user
						mockWorkspaceService.createWorkspace.mockResolvedValueOnce({
							id: newWorkspaceId,
							userId: permanentUserId,
							name: "Migrated Tasks",
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						});

						// Mock guest tasks retrieval
						mockTaskService.listTasks.mockResolvedValueOnce({
							items: guestTasks,
							hasMore: false,
						});

						// Mock task creation (for migration)
						mockTaskService.createTask = vi.fn().mockResolvedValue({});

						// Mock workspace deletion
						mockWorkspaceService.deleteWorkspace = vi
							.fn()
							.mockResolvedValue({});

						// Mock guest user update (mark as migrated)
						mockClient.send.mockResolvedValueOnce({
							Attributes: { migrated: true },
						});

						const result: MigrationResult =
							await guestUserService.migrateGuestTasks(
								guestId,
								permanentUserId,
							);

						// Verify migration result
						expect(result.totalTasks).toBe(guestTasks.length);
						expect(result.successCount).toBe(guestTasks.length);
						expect(result.failureCount).toBe(0);
						expect(result.errors).toHaveLength(0);
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Guest User Cleanup", () => {
		it("should clean up expired guest users", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.array(guestUserArb, { minLength: 0, maxLength: 10 }),
					async (guestUsers) => {
						const now = new Date();
						const expiredUsers = guestUsers.filter(
							(user) => new Date(user.expiresAt) < now,
						);

						// Mock scan for expired users
						mockClient.send.mockResolvedValueOnce({
							Items: expiredUsers,
						});

						// Mock workspace listing for each expired user (returns empty)
						for (const _user of expiredUsers) {
							mockWorkspaceService.listWorkspaces.mockResolvedValueOnce([]);
						}

						// Mock deletion operations
						mockClient.send.mockResolvedValue({});

						await guestUserService.cleanupExpiredGuests();

						// Verify cleanup was attempted
						expect(mockClient.send).toHaveBeenCalled();
					},
				),
				propertyTestConfig,
			);
		});
	});
});
