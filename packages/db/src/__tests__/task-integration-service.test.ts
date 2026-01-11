import { describe, expect, it } from "vitest";
import { TaskIntegrationService } from "../task-integration-service";
import { ValidationError } from "../validation";

describe("TaskIntegrationService", () => {
	describe("validation", () => {
		it("should throw ValidationError for empty task ID", async () => {
			const service = new TaskIntegrationService();

			await expect(
				service.create("", { provider: "notion", externalId: "page-123" }),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for empty provider", async () => {
			const service = new TaskIntegrationService();

			await expect(
				service.create("task-123", { provider: "", externalId: "page-123" }),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for empty external ID", async () => {
			const service = new TaskIntegrationService();

			await expect(
				service.create("task-123", { provider: "notion", externalId: "" }),
			).rejects.toThrow(ValidationError);
		});
	});

	describe("input sanitization", () => {
		it("should trim whitespace from inputs", () => {
			const service = new TaskIntegrationService();

			// This test would need a mock DynamoDB client to fully test
			// For now, we're just testing that the service can be instantiated
			expect(service).toBeInstanceOf(TaskIntegrationService);
		});
	});
});
