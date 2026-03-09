import { describe, expect, it, vi } from "vitest";
import { WorkspaceIntegrationService } from "../workspace-integration-service";

const mockSend = vi.fn();

vi.mock("../client", () => ({
	getDynamoDBClient: vi.fn(() => ({ send: mockSend })),
	getTableName: vi.fn((tableName: string) => `test-${tableName}-table`),
}));

describe("WorkspaceIntegrationService", () => {
	describe("findByProviderAndExternalId", () => {
		it("returns first matching integration", async () => {
			const service = new WorkspaceIntegrationService();
			mockSend.mockResolvedValueOnce({
				Items: [
					{
						id: "integration-1",
						workspaceId: "workspace-1",
						provider: "notion",
						externalId: "db-1",
						syncEnabled: true,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				],
			});

			const result = await service.findByProviderAndExternalId("notion", "db-1");

			expect(result?.workspaceId).toBe("workspace-1");
			expect(mockSend).toHaveBeenCalledTimes(1);
		});

		it("returns null when no integration matches", async () => {
			const service = new WorkspaceIntegrationService();
			mockSend.mockResolvedValueOnce({ Items: [] });

			const result = await service.findByProviderAndExternalId("notion", "db-2");

			expect(result).toBeNull();
		});
	});
});
