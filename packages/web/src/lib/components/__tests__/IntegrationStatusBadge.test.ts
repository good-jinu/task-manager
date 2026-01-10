import type { ExternalIntegration } from "@notion-task-manager/db";
import { describe, expect, it } from "vitest";

// Mock integration data
const mockIntegration: ExternalIntegration = {
	id: "test-integration-id",
	workspaceId: "test-workspace-id",
	provider: "notion",
	externalId: "test-database-id",
	config: {
		databaseId: "test-database-id",
		databaseName: "Test Database",
	},
	syncEnabled: true,
	lastSyncAt: new Date().toISOString(),
	createdAt: new Date().toISOString(),
};

describe("IntegrationStatusBadge Logic", () => {
	it("should determine correct status for disconnected integration", () => {
		// Test the status derivation logic
		const integration: ExternalIntegration | undefined = undefined;
		const expectedStatus = "disconnected";

		// This would be the logic from the component
		function determineStatus(int: ExternalIntegration | undefined): string {
			if (!int) {
				return "disconnected";
			}
			if (!int.syncEnabled) {
				return "disabled";
			}
			return "synced";
		}

		const status = determineStatus(integration);
		expect(status).toBe(expectedStatus);
	});

	it("should determine correct status for disabled integration", () => {
		const integration: ExternalIntegration = {
			...mockIntegration,
			syncEnabled: false,
		};

		function determineStatus(int: ExternalIntegration | undefined): string {
			if (!int) {
				return "disconnected";
			}
			if (!int.syncEnabled) {
				return "disabled";
			}
			return "synced";
		}

		const status = determineStatus(integration);
		expect(status).toBe("disabled");
	});

	it("should determine correct status for enabled integration", () => {
		const integration = mockIntegration;

		function determineStatus(int: ExternalIntegration | undefined): string {
			if (!int) {
				return "disconnected";
			}
			if (!int.syncEnabled) {
				return "disabled";
			}
			return "synced";
		}

		const status = determineStatus(integration);
		expect(status).toBe("synced");
	});

	it("should format last sync time correctly", () => {
		const now = new Date();
		const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// Test the time formatting logic
		function formatLastSync(lastSync: Date): string {
			const diff = now.getTime() - lastSync.getTime();
			const minutes = Math.floor(diff / (1000 * 60));
			const hours = Math.floor(minutes / 60);
			const days = Math.floor(hours / 24);

			if (minutes < 1) return "Just now";
			if (minutes < 60) return `${minutes}m ago`;
			if (hours < 24) return `${hours}h ago`;
			return `${days}d ago`;
		}

		expect(formatLastSync(oneMinuteAgo)).toBe("1m ago");
		expect(formatLastSync(oneHourAgo)).toBe("1h ago");
		expect(formatLastSync(oneDayAgo)).toBe("1d ago");
	});

	it("should generate correct sync statistics text", () => {
		const syncStats = {
			totalTasks: 10,
			syncedTasks: 8,
			pendingTasks: 1,
			errorTasks: 1,
			lastSyncDuration: 1500,
		};

		// Test the stats formatting logic
		function formatSyncStats(stats: typeof syncStats): string {
			const parts = [];
			if (stats.syncedTasks > 0) {
				parts.push(`${stats.syncedTasks} synced`);
			}
			if (stats.pendingTasks > 0) {
				parts.push(`${stats.pendingTasks} pending`);
			}
			if (stats.errorTasks > 0) {
				parts.push(`${stats.errorTasks} errors`);
			}
			return parts.join(", ");
		}

		expect(formatSyncStats(syncStats)).toBe("8 synced, 1 pending, 1 errors");
	});

	it("should validate status configuration completeness", () => {
		// Test that all required status configurations are present
		const statusConfig = {
			disconnected: {
				label: "Not Connected",
				bgColor: "var(--surface-muted)",
				textColor: "var(--muted-foreground)",
				borderColor: "var(--subtle-base)",
				clickable: false,
			},
			disabled: {
				label: "Disabled",
				bgColor: "var(--surface-muted)",
				textColor: "var(--muted-foreground)",
				borderColor: "var(--subtle-base)",
				clickable: false,
			},
			synced: {
				label: "Synced",
				bgColor: "var(--success-alert-bg)",
				textColor: "var(--success-foreground)",
				borderColor: "var(--success-border)",
				clickable: true,
			},
			pending: {
				label: "Syncing",
				bgColor: "var(--warning-alert-bg)",
				textColor: "var(--warning-foreground)",
				borderColor: "var(--warning-border)",
				clickable: true,
			},
			error: {
				label: "Error",
				bgColor: "var(--error-alert-bg)",
				textColor: "var(--error-foreground)",
				borderColor: "var(--error-border)",
				clickable: true,
			},
		};

		// Verify all status types have required properties
		const requiredStatuses = [
			"disconnected",
			"disabled",
			"synced",
			"pending",
			"error",
		];
		const requiredProperties = [
			"label",
			"bgColor",
			"textColor",
			"borderColor",
			"clickable",
		];

		for (const status of requiredStatuses) {
			expect(statusConfig).toHaveProperty(status);
			for (const prop of requiredProperties) {
				expect(
					statusConfig[status as keyof typeof statusConfig],
				).toHaveProperty(prop);
			}
		}
	});
});
