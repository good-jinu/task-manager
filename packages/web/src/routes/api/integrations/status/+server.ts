import { json } from "@sveltejs/kit";
import {
	type WorkspaceIntegration,
	WorkspaceIntegrationService,
} from "@task-manager/db";
import type { RequestHandler } from "./$types";

interface IntegrationStatusResponse {
	status: "disconnected" | "disabled" | "synced" | "pending" | "error";
	lastSyncAt?: string;
	lastError?: string;
	syncCount?: number;
	conflictCount?: number;
}

interface SyncStatistics {
	totalTasks: number;
	syncedTasks: number;
	pendingTasks: number;
	errorTasks: number;
	lastSyncDuration?: number;
}

interface WorkspaceIntegrationData {
	integration: {
		id: string;
		provider: string;
		syncEnabled: boolean;
		config?: {
			databaseId?: string;
			databaseName?: string;
			importExisting?: boolean;
		};
		lastSyncAt?: string;
	};
	status: IntegrationStatusResponse;
	stats: SyncStatistics;
}

function determineIntegrationStatus(
	integration: WorkspaceIntegration,
): IntegrationStatusResponse {
	if (!integration.syncEnabled) {
		return {
			status: "disabled",
			lastSyncAt: integration.lastSyncAt,
			lastError: integration.lastError,
			syncCount: 0,
			conflictCount: 0,
		};
	}

	if (integration.lastError) {
		return {
			status: "error",
			lastSyncAt: integration.lastSyncAt,
			lastError: integration.lastError,
			syncCount: 0,
			conflictCount: 0,
		};
	}

	if (integration.lastSyncAt) {
		const lastSync = new Date(integration.lastSyncAt);
		const now = new Date();
		const timeDiff = now.getTime() - lastSync.getTime();
		const fiveMinutes = 5 * 60 * 1000;

		return {
			status: timeDiff < fiveMinutes ? "synced" : "pending",
			lastSyncAt: integration.lastSyncAt,
			syncCount: 0, // TODO: Implement actual sync counting
			conflictCount: 0, // TODO: Implement conflict tracking
		};
	}

	return {
		status: "pending",
		syncCount: 0,
		conflictCount: 0,
	};
}

function createDefaultStats(): SyncStatistics {
	return {
		totalTasks: 0,
		syncedTasks: 0,
		pendingTasks: 0,
		errorTasks: 0,
		lastSyncDuration: undefined,
	};
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const workspaceId = url.searchParams.get("workspaceId");
		const integrationId = url.searchParams.get("integrationId");

		if (!workspaceId) {
			return json({ error: "Workspace ID is required" }, { status: 400 });
		}

		const workspaceIntegrationService = new WorkspaceIntegrationService();

		// If specific integration requested, return just that one
		if (integrationId) {
			const integration =
				await workspaceIntegrationService.getById(integrationId);

			if (!integration) {
				return json({
					integration: null,
					status: { status: "disconnected" as const },
					stats: createDefaultStats(),
				});
			}

			const status = determineIntegrationStatus(integration);
			const stats = createDefaultStats(); // TODO: Calculate actual stats

			return json({
				integration: {
					id: integration.id,
					provider: integration.provider,
					syncEnabled: integration.syncEnabled,
					config: integration.config,
					lastSyncAt: integration.lastSyncAt,
				},
				status,
				stats,
			});
		}

		// Return all integrations for the workspace
		const integrations =
			await workspaceIntegrationService.listByWorkspace(workspaceId);

		const integrationData: WorkspaceIntegrationData[] = integrations.map(
			(integration) => ({
				integration: {
					id: integration.id,
					provider: integration.provider,
					syncEnabled: integration.syncEnabled,
					config: integration.config,
					lastSyncAt: integration.lastSyncAt,
				},
				status: determineIntegrationStatus(integration),
				stats: createDefaultStats(), // TODO: Calculate actual stats per integration
			}),
		);

		return json({
			integrations: integrationData,
		});
	} catch (error) {
		console.error("Failed to get integration status:", error);
		return json({ error: "Failed to get integration status" }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { integrationId, action } = await request.json();

		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const workspaceIntegrationService = new WorkspaceIntegrationService();

		switch (action) {
			case "refresh": {
				// Get the integration
				const integration =
					await workspaceIntegrationService.getById(integrationId);

				if (!integration) {
					return json({ error: "Integration not found" }, { status: 404 });
				}

				// TODO: Implement actual sync logic here
				// For now, just update the sync timestamp
				const updatedIntegration =
					await workspaceIntegrationService.updateSyncStatus(
						integrationId,
						true, // success
					);

				return json({
					success: true,
					status: determineIntegrationStatus(updatedIntegration),
				});
			}

			default:
				return json({ error: "Invalid action" }, { status: 400 });
		}
	} catch (error) {
		console.error("Failed to update integration status:", error);
		return json(
			{ error: "Failed to update integration status" },
			{ status: 500 },
		);
	}
};
