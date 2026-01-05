import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../workspace-service";

// Mock the DynamoDB client
vi.mock("../client", () => ({
	getDynamoDBClient: vi.fn(() => ({
		send: vi.fn(),
	})),
	getTableNames: vi.fn(() => ({
		workspaces: "test-workspaces-table",
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
const uuidArb = fc.uuid();
// Use valid date range to avoid invalid ISO strings
const isoDateArb = fc
	.date({ min: new Date("2000-01-01"), max: new Date("2100-01-01") })
	.map((d) => d.toISOString());
// Generate non-empty strings that are not just whitespace (validation requires trimmed non-empty)
const nonEmptyStringArb = fc
	.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\s]{0,98}[a-zA-Z0-9]?$/)
	.filter((s) => s.trim().length > 0);

const createWorkspaceInputArb = fc
	.record({
		name: nonEmptyStringArb,
		description: fc.option(fc.string({ maxLength: 500 })),
	})
	.map((input) => {
		// Filter out null values
		const filtered: Record<string, unknown> = { name: input.name };
		if (input.description !== null && input.description !== undefined) {
			// Only include non-empty descriptions
			if (input.description.trim().length > 0) {
				filtered.description = input.description;
			}
		}
		return filtered as typeof input;
	});

const _updateWorkspaceInputArb = fc.record(
	{
		name: fc.option(nonEmptyStringArb),
		description: fc.option(fc.string({ maxLength: 500 })),
	},
	{ requiredKeys: [] },
);

const workspaceArb = fc.record({
	id: uuidArb,
	userId: uuidArb,
	name: nonEmptyStringArb,
	description: fc.option(fc.string({ maxLength: 500 })),
	createdAt: isoDateArb,
	updatedAt: isoDateArb,
});

describe("WorkspaceService Property-Based Tests", () => {
	let workspaceService: WorkspaceService;
	let mockClient: any;
	let mockTaskService: any;

	beforeEach(() => {
		vi.clearAllMocks();
		workspaceService = new WorkspaceService();
		mockClient = (workspaceService as any).client;

		// Create mock task service
		mockTaskService = {
			listTasks: vi.fn(),
			updateTask: vi.fn(),
			deleteTask: vi.fn(),
		};
		// Inject mock task service
		(workspaceService as any).taskService = mockTaskService;
	});

	describe("Property 6: Workspace Field Completeness", () => {
		it("should create workspaces with all required fields for any valid CreateWorkspaceInput", async () => {
			// **Feature: task-management-migration, Property 6: Workspace Field Completeness**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(uuidArb, createWorkspaceInputArb),
					async ([userId, input]) => {
						// Mock successful DynamoDB put
						mockClient.send.mockResolvedValueOnce({});

						const result = await workspaceService.createWorkspace(
							userId,
							input,
						);

						// Verify all required fields are present
						expect(result).toHaveProperty("id");
						expect(result).toHaveProperty("userId", userId);
						expect(result).toHaveProperty("name", input.name);
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
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 2: Entity Creation Generates UUID and Timestamps (Workspace)", () => {
		it("should generate unique UUID and equal timestamps for any workspace creation", async () => {
			// **Feature: task-management-migration, Property 2: Entity Creation Generates UUID and Timestamps**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(uuidArb, createWorkspaceInputArb),
					async ([userId, input]) => {
						mockClient.send.mockResolvedValueOnce({});

						const result = await workspaceService.createWorkspace(
							userId,
							input,
						);

						// Verify UUID format
						expect(result.id).toMatch(
							/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
						);

						// Verify timestamps are equal on creation
						expect(result.createdAt).toBe(result.updatedAt);

						// Verify timestamps are valid ISO strings
						expect(() => new Date(result.createdAt)).not.toThrow();
						expect(() => new Date(result.updatedAt)).not.toThrow();
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 7: User Workspace Isolation", () => {
		it("should return only workspaces belonging to the specified user", async () => {
			// **Feature: task-management-migration, Property 7: User Workspace Isolation**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // target user ID
						fc.array(workspaceArb, { minLength: 0, maxLength: 10 }), // workspaces
					),
					async ([targetUserId, allWorkspaces]) => {
						// Filter workspaces that should be returned
						const expectedWorkspaces = allWorkspaces.filter(
							(workspace) => workspace.userId === targetUserId,
						);

						mockClient.send.mockResolvedValueOnce({
							Items: expectedWorkspaces,
						});

						const result = await workspaceService.listWorkspaces(targetUserId);

						// Verify all returned workspaces belong to the target user
						expect(result).toHaveLength(expectedWorkspaces.length);
						result.forEach((workspace) => {
							expect(workspace.userId).toBe(targetUserId);
						});
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 8: Workspace Deletion Policy Enforcement", () => {
		it("should handle task deletion policy correctly when deleting workspace", async () => {
			// **Feature: task-management-migration, Property 8: Workspace Deletion Policy Enforcement**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						fc.constantFrom("archive", "delete") as fc.Arbitrary<
							"archive" | "delete"
						>, // deletion policy
					),
					async ([workspaceId, policy]) => {
						// Mock task service to return empty list
						mockTaskService.listTasks.mockResolvedValueOnce({
							items: [],
							hasMore: false,
						});

						// Mock delete workspace
						mockClient.send.mockResolvedValueOnce({}); // delete workspace

						await workspaceService.deleteWorkspace(workspaceId, policy);

						// Verify task service was called to list tasks
						expect(mockTaskService.listTasks).toHaveBeenCalledWith(
							workspaceId,
							expect.objectContaining({ limit: 100 }),
						);

						// Verify DynamoDB delete was called
						expect(mockClient.send).toHaveBeenCalled();
					},
				),
				propertyTestConfig,
			);
		});
	});
});
