import {
	IntegrationService,
	type SyncMetadata,
	SyncMetadataService,
	SyncScheduler,
	SyncService,
	SyncStatisticsService,
	TaskService,
	ValidationError,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * PUT /api/integrations/[id]/sync
 * Triggers a manual sync for the specified integration with enhanced timing controls
 */
export const PUT: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const {
			force = false,
			immediate = true,
			syncType = "full", // "full" | "incremental"
		} = await event.request.json().catch(() => ({}));

		const integrationService = new IntegrationService();
		const syncService = new SyncService(
			new SyncMetadataService(),
			new TaskService(),
			integrationService,
		);
		const syncScheduler = new SyncScheduler(
			syncService,
			integrationService,
			new TaskService(),
			new SyncStatisticsService(),
		);

		try {
			// Get the integration
			const integration =
				await integrationService.getIntegration(integrationId);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			// Check if sync is enabled
			if (!integration.syncEnabled && !force) {
				return json(
					{ error: "Sync is disabled for this integration" },
					{ status: 400 },
				);
			}

			// Trigger manual sync using the scheduler
			const startTime = Date.now();
			await syncScheduler.triggerManualSync(integrationId);
			const syncDuration = Date.now() - startTime;

			// Get updated sync statistics
			const syncStats = await syncScheduler.getSyncStatistics(integrationId);
			const queueStatus = syncService.getSyncQueueStatus();

			// Update integration with last sync timestamp
			const now = new Date().toISOString();
			await integrationService.updateIntegration(integrationId, {
				lastSyncAt: now,
			});

			return json({
				success: true,
				syncResult: {
					status: "completed",
					syncDuration,
					triggeredAt: now,
					syncType,
					queueStatus: {
						queueLength: queueStatus.queueLength,
						isProcessing: queueStatus.isProcessing,
					},
					statistics: syncStats
						? {
								totalSyncAttempts: syncStats.totalSyncAttempts,
								successfulSyncs: syncStats.successfulSyncs,
								failedSyncs: syncStats.failedSyncs,
								conflictCount: syncStats.conflictCount,
								averageSyncDuration: syncStats.averageSyncDuration,
								lastSyncAt: syncStats.lastSyncAt,
								manualSyncCount: syncStats.manualSyncCount,
							}
						: null,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to trigger sync:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json(
				{
					error: error.message,
				},
				{ status: 400 },
			);
		}

		return json(
			{
				error: "Failed to trigger sync",
			},
			{ status: 500 },
		);
	}
};

/**
 * GET /api/integrations/[id]/sync
 * Gets the current sync status and statistics for the specified integration
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
		const syncService = new SyncService(
			syncMetadataService,
			new TaskService(),
			integrationService,
		);
		const syncScheduler = new SyncScheduler(
			syncService,
			integrationService,
			new TaskService(),
			new SyncStatisticsService(),
		);

		try {
			// Get the integration
			const integration =
				await integrationService.getIntegration(integrationId);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			// Get sync timing options
			const timingOptions =
				await syncService.getSyncTimingOptions(integrationId);

			// Get sync statistics from scheduler
			const syncStats = await syncScheduler.getSyncStatistics(integrationId);

			// Get queue status
			const queueStatus = syncService.getSyncQueueStatus();

			// Get sync metadata for this integration
			const syncMetadata =
				await syncMetadataService.listSyncMetadataByIntegration(integrationId);

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
			let status: "disconnected" | "disabled" | "synced" | "pending" | "error" =
				"disconnected";
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

			return json({
				integration,
				syncStatus: {
					status,
					lastSyncAt: integration.lastSyncAt,
					lastError,
					syncCount: syncedTasks,
					conflictCount: conflictTasks,
				},
				syncStats: {
					totalTasks,
					syncedTasks,
					pendingTasks,
					errorTasks,
					lastSyncDuration: syncStats?.lastSyncDuration || null,
				},
				timingOptions,
				queueStatus: {
					queueLength: queueStatus.queueLength,
					isProcessing: queueStatus.isProcessing,
					nextScheduledSync: queueStatus.nextScheduledSync,
				},
				statistics: syncStats
					? {
							totalSyncAttempts: syncStats.totalSyncAttempts,
							successfulSyncs: syncStats.successfulSyncs,
							failedSyncs: syncStats.failedSyncs,
							conflictCount: syncStats.conflictCount,
							averageSyncDuration: syncStats.averageSyncDuration,
							lastSyncAt: syncStats.lastSyncAt,
							lastSyncAttemptAt: syncStats.lastSyncAttemptAt,
							lastSyncError: syncStats.lastSyncError,
							lastSyncErrorAt: syncStats.lastSyncErrorAt,
							manualSyncCount: syncStats.manualSyncCount,
							lastManualSyncAt: syncStats.lastManualSyncAt,
						}
					: null,
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to get sync status:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get sync status",
			},
			{ status: 500 },
		);
	}
};
