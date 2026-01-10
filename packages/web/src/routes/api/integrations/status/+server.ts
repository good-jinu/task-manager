import {
	type ExternalIntegration,
	IntegrationService,
	type SyncMetadata,
	SyncMetadataService,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
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

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const workspaceId = url.searchParams.get("workspaceId");
		const integrationId = url.searchParams.get("integrationId");

		if (!workspaceId) {
			return json({ error: "Workspace ID is required" }, { status: 400 });
		}

		// Initialize services
		const integrationService = new IntegrationService();
		const syncMetadataService = new SyncMetadataService();

		// Get all integrations for the workspace
		const integrations = await integrationService.listIntegrations(workspaceId);

		const statusMap = new Map<string, IntegrationStatusResponse>();
		const statsMap = new Map<string, SyncStatistics>();

		for (const integration of integrations) {
			// Get sync metadata for this integration
			const syncMetadata =
				await syncMetadataService.listSyncMetadataByIntegration(integration.id);

			// Calculate sync statistics
			const totalTasks = syncMetadata.length;
			const syncedTasks = syncMetadata.filter(
				(sm: SyncMetadata) => sm.syncStatus === "synced",
			).length;
			const pendingTasks = syncMetadata.filter(
				(sm: SyncMetadata) => sm.syncStatus === "pending",
			).length;
			const errorTasks = syncMetadata.filter(
				(sm: SyncMetadata) => sm.syncStatus === "error",
			).length;
			const conflictTasks = syncMetadata.filter(
				(sm: SyncMetadata) => sm.syncStatus === "conflict",
			).length;

			// Determine overall status
			let status: IntegrationStatusResponse["status"] = "disconnected";
			let lastError: string | undefined;

			if (!integration.syncEnabled) {
				status = "disabled";
			} else if (errorTasks > 0) {
				status = "error";
				// Get the most recent error
				const errorMetadata = syncMetadata
					.filter(
						(sm: SyncMetadata) => sm.syncStatus === "error" && sm.lastError,
					)
					.sort((a: SyncMetadata, b: SyncMetadata) =>
						(b.lastSyncAt || "").localeCompare(a.lastSyncAt || ""),
					)[0];
				lastError = errorMetadata?.lastError;
			} else if (pendingTasks > 0 || conflictTasks > 0) {
				status = "pending";
			} else if (syncedTasks > 0) {
				status = "synced";
			} else {
				status = "pending"; // No tasks synced yet
			}

			// Calculate last sync duration (mock for now)
			const lastSyncDuration = Math.floor(Math.random() * 5000) + 500;

			statusMap.set(integration.id, {
				status,
				lastSyncAt: integration.lastSyncAt,
				lastError,
				syncCount: syncedTasks,
				conflictCount: conflictTasks,
			});

			statsMap.set(integration.id, {
				totalTasks,
				syncedTasks,
				pendingTasks,
				errorTasks,
				lastSyncDuration,
			});
		}

		// If specific integration requested, return just that one
		if (integrationId) {
			const integration = integrations.find(
				(i: ExternalIntegration) => i.id === integrationId,
			);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			return json({
				integration: integration,
				status: statusMap.get(integrationId),
				stats: statsMap.get(integrationId),
			});
		}

		// Return all integrations with their status
		return json({
			integrations: integrations.map((integration: ExternalIntegration) => ({
				integration,
				status: statusMap.get(integration.id),
				stats: statsMap.get(integration.id),
			})),
		});
	} catch (error) {
		console.error("Failed to get integration status:", error);
		return json({ error: "Failed to get integration status" }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { integrationId, action } = await request.json();

		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		// Initialize services
		const integrationService = new IntegrationService();
		const syncMetadataService = new SyncMetadataService();

		const integration = await integrationService.getIntegration(integrationId);
		if (!integration) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		switch (action) {
			case "refresh": {
				// Trigger a manual sync refresh
				// In a real implementation, this would trigger the sync process
				await integrationService.updateIntegration(integrationId, {
					lastSyncAt: new Date().toISOString(),
				});

				// Return updated status
				const syncMetadata =
					await syncMetadataService.listSyncMetadataByIntegration(
						integrationId,
					);
				const syncedTasks = syncMetadata.filter(
					(sm: SyncMetadata) => sm.syncStatus === "synced",
				).length;
				const errorTasks = syncMetadata.filter(
					(sm: SyncMetadata) => sm.syncStatus === "error",
				).length;
				const pendingTasks = syncMetadata.filter(
					(sm: SyncMetadata) => sm.syncStatus === "pending",
				).length;
				const conflictTasks = syncMetadata.filter(
					(sm: SyncMetadata) => sm.syncStatus === "conflict",
				).length;

				let status: IntegrationStatusResponse["status"] = "synced";
				if (errorTasks > 0) status = "error";
				else if (pendingTasks > 0 || conflictTasks > 0) status = "pending";

				return json({
					success: true,
					status: {
						status,
						lastSyncAt: new Date().toISOString(),
						syncCount: syncedTasks,
						conflictCount: conflictTasks,
					},
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
