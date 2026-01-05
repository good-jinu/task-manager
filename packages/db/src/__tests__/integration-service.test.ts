import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationService } from "../integration-service";
import type { CreateIntegrationInput, UpdateIntegrationInput } from "../types";

// Mock the DynamoDB client
vi.mock("../client", () => ({
	getDynamoDBClient: vi.fn(() => ({
		send: vi.fn(),
	})),
	getTableNames: vi.fn(() => ({
		integrations: "test-integrations-table",
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
// Generate non-empty strings that are not just whitespace (validation requires trimmed non-empty)
const nonEmptyStringArb = fc
	.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\s]{0,98}[a-zA-Z0-9]?$/)
	.filter((s) => s.trim().length > 0);
const providerArb = fc.constantFrom("notion", "trello", "asana", "jira");

const createIntegrationInputArb = fc
	.record({
		provider: providerArb,
		externalId: nonEmptyStringArb,
		config: fc.dictionary(fc.string(), fc.anything()),
		syncEnabled: fc.boolean(), // Always provide a boolean, not null
	})
	.map((input) => {
		// Ensure config is a plain object
		return {
			...input,
			config: input.config || {},
		};
	});

const _updateIntegrationInputArb = fc.record(
	{
		config: fc.option(fc.dictionary(fc.string(), fc.anything())),
		syncEnabled: fc.option(fc.boolean()),
	},
	{ requiredKeys: [] },
);

const integrationArb = fc.record({
	id: uuidArb,
	workspaceId: uuidArb,
	provider: providerArb,
	externalId: nonEmptyStringArb,
	config: fc.dictionary(fc.string(), fc.anything()),
	syncEnabled: fc.boolean(),
	lastSyncAt: fc.option(isoDateArb),
	createdAt: isoDateArb,
});

describe("IntegrationService Property-Based Tests", () => {
	let integrationService: IntegrationService;
	let mockClient: any;

	beforeEach(() => {
		vi.clearAllMocks();
		integrationService = new IntegrationService();
		mockClient = (integrationService as any).client;
	});

	describe("Property 9: Integration Field Completeness", () => {
		it("should create integrations with all required fields for any valid CreateIntegrationInput", async () => {
			// **Feature: task-management-migration, Property 9: Integration Field Completeness**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(uuidArb, createIntegrationInputArb),
					async ([workspaceId, input]) => {
						// Mock successful DynamoDB put
						mockClient.send.mockResolvedValueOnce({});

						const result = await integrationService.createIntegration(
							workspaceId,
							input,
						);

						// Verify all required fields are present
						expect(result).toHaveProperty("id");
						expect(result).toHaveProperty("workspaceId", workspaceId);
						expect(result).toHaveProperty("provider", input.provider);
						expect(result).toHaveProperty("externalId", input.externalId);
						expect(result).toHaveProperty("config", input.config);
						expect(result).toHaveProperty("syncEnabled");
						expect(result).toHaveProperty("createdAt");

						// Verify field types and values
						expect(typeof result.id).toBe("string");
						expect(result.id).toMatch(
							/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
						);
						expect(typeof result.createdAt).toBe("string");
						expect(new Date(result.createdAt)).toBeInstanceOf(Date);
						expect(typeof result.syncEnabled).toBe("boolean");
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 10: One Integration Per Provider Per Workspace", () => {
		it("should prevent duplicate integrations for same provider in workspace", async () => {
			// **Feature: task-management-migration, Property 10: One Integration Per Provider Per Workspace**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						uuidArb, // workspace ID
						providerArb, // provider
						fc.array(integrationArb, { minLength: 0, maxLength: 5 }), // existing integrations
					),
					async ([workspaceId, provider, existingIntegrations]) => {
						const hasExistingProvider = existingIntegrations.some(
							(integration) =>
								integration.workspaceId === workspaceId &&
								integration.provider === provider,
						);

						const input: CreateIntegrationInput = {
							provider,
							externalId: "test-external-id",
							config: {},
						};

						if (hasExistingProvider) {
							// Mock query returning existing integration
							mockClient.send.mockResolvedValueOnce({
								Items: [
									existingIntegrations.find((i) => i.provider === provider),
								],
							});

							// Should fail due to duplicate provider
							await expect(
								integrationService.createIntegration(workspaceId, input),
							).rejects.toThrow();
						} else {
							// Mock query returning no existing integration, then successful put
							mockClient.send
								.mockResolvedValueOnce({ Items: [] }) // query check
								.mockResolvedValueOnce({}); // put operation

							const result = await integrationService.createIntegration(
								workspaceId,
								input,
							);
							expect(result.provider).toBe(provider);
							expect(result.workspaceId).toBe(workspaceId);
						}
					},
				),
				propertyTestConfig,
			);
		});
	});

	describe("Property 11: Disabled Integration Stops Sync", () => {
		it("should respect syncEnabled flag for sync operations", async () => {
			// **Feature: task-management-migration, Property 11: Disabled Integration Stops Sync**
			await fc.assert(
				fc.asyncProperty(
					fc.tuple(
						integrationArb,
						fc.boolean(), // new syncEnabled value
					),
					async ([integration, newSyncEnabled]) => {
						const updateInput: UpdateIntegrationInput = {
							syncEnabled: newSyncEnabled,
						};

						// Mock successful update
						const updatedIntegration = {
							...integration,
							syncEnabled: newSyncEnabled,
						};

						mockClient.send.mockResolvedValueOnce({
							Attributes: updatedIntegration,
						});

						const result = await integrationService.updateIntegration(
							integration.id,
							updateInput,
						);

						// Verify syncEnabled is updated correctly
						expect(result.syncEnabled).toBe(newSyncEnabled);

						// The sync behavior verification would be in the SyncService tests
						// Here we just verify the integration state is correctly updated
					},
				),
				propertyTestConfig,
			);
		});
	});
});
