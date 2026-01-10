import {
	IntegrationService,
	SyncMetadataService,
	TaskService,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

interface IntegrationStatus {
	status: "disconnected" | "disabled" | "synced" | "pending" | "error";
	lastSyncAt?: Date;
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

/**
 * GET /api/integrations/[id]/status
 * Gets real-time status and statistics for an integration
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const integrationService = new IntegrationService();
		const syncMetadataService = new SyncMetadataService();
		const taskService = new TaskService();

		// Get integration
		const integration = await integrationService.getIntegration(integrationId);
		if (!integration) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		// Determine status
		let status: IntegrationStatus["status"] = "disconnected";
		let lastError: string | undefined;
		let syncCount = 0;
		let conflictCount = 0;

		if (!integration.syncEnabled) {
			status = "disabled";
		} else {
			// Check sync metadata to determine actual status
			// Note: This would require implementing methods to query sync metadata by integration
			// For now, we'll use basic logic based on lastSyncAt

			if (integration.lastSyncAt) {
				const lastSync = new Date(integration.lastSyncAt);
				const now = new Date();
				const timeDiff = now.getTime() - lastSync.getTime();
				const fiveMinutes = 5 * 60 * 1000;

				// If last sync was within 5 minutes, consider it synced
				// Otherwise, it might be pending or have errors
				status = timeDiff < fiveMinutes ? "synced" : "pending";
			} else {
				status = "pending";
			}
		}

		// Get sync statistics
		// Note: These would require additional database queries
		// For now, we'll return basic information
		const syncStats: SyncStatistics = {
			totalTasks: 0,
			syncedTasks: syncCount,
			pendingTasks: 0,
			errorTasks: 0,
		};

		// Cache the result for a short time to avoid repeated calculations
		event.setHeaders({
			"Cache-Control": "private, max-age=30", // 30 seconds
		});

		return json({
			status: {
				status,
				lastSyncAt: integration.lastSyncAt
					? new Date(integration.lastSyncAt)
					: undefined,
				lastError,
				syncCount,
				conflictCount,
			} as IntegrationStatus,
			statistics: syncStats,
			integration: {
				id: integration.id,
				provider: integration.provider,
				syncEnabled: integration.syncEnabled,
				createdAt: integration.createdAt,
			},
		});
	} catch (error) {
		console.error("Failed to get integration status:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get integration status",
			},
			{ status: 500 },
		);
	}
};
