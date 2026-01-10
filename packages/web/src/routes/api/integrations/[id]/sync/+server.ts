import {
	IntegrationService,
	SyncMetadataService,
	TaskService,
	ValidationError,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * PUT /api/integrations/[id]/sync
 * Triggers a manual sync for the specified integration
 */
export const PUT: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const { force = false } = await event.request.json().catch(() => ({}));

		const integrationService = new IntegrationService();
		const syncMetadataService = new SyncMetadataService();
		const taskService = new TaskService();

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

			// Update last sync attempt timestamp
			const now = new Date().toISOString();
			await integrationService.updateIntegration(integrationId, {
				lastSyncAt: now,
			});

			// Get all tasks for the workspace to sync
			const tasksResult = await taskService.listTasks(integration.workspaceId);
			const tasks = tasksResult.items;

			// Get existing sync metadata
			const existingSyncMetadata =
				await syncMetadataService.listSyncMetadataByIntegration(integrationId);

			// Create a map for quick lookup
			const syncMetadataMap = new Map(
				existingSyncMetadata.map((sm: any) => [sm.taskId, sm]),
			);

			let syncedCount = 0;
			let pendingCount = 0;
			let errorCount = 0;

			// Process each task
			for (const task of tasks) {
				try {
					const existingMetadata = syncMetadataMap.get(task.id);

					if (existingMetadata) {
						// Update existing sync metadata
						await syncMetadataService.updateSyncMetadata(
							task.id,
							integrationId,
							{
								syncStatus: "synced",
								lastSyncAt: now,
								lastError: undefined,
							},
						);
					} else {
						// Create new sync metadata
						const newMetadata = await syncMetadataService.createSyncMetadata({
							taskId: task.id,
							integrationId,
							externalId: `notion-${task.id}`, // Mock external ID
							syncStatus: "synced",
						});

						// Update with lastSyncAt
						await syncMetadataService.updateSyncMetadata(
							task.id,
							integrationId,
							{
								lastSyncAt: now,
							},
						);
					}

					syncedCount++;
				} catch (error) {
					// Handle individual task sync errors
					const existingMetadata = syncMetadataMap.get(task.id);
					const errorMessage =
						error instanceof Error ? error.message : "Unknown sync error";

					if (existingMetadata) {
						await syncMetadataService.updateSyncMetadata(
							task.id,
							integrationId,
							{
								syncStatus: "error",
								lastSyncAt: now,
								lastError: errorMessage,
							},
						);
					} else {
						const newMetadata = await syncMetadataService.createSyncMetadata({
							taskId: task.id,
							integrationId,
							externalId: `notion-${task.id}`,
							syncStatus: "error",
						});

						// Update with error details
						await syncMetadataService.updateSyncMetadata(
							task.id,
							integrationId,
							{
								lastSyncAt: now,
								lastError: errorMessage,
							},
						);
					}

					errorCount++;
				}
			}

			// Calculate final status
			let overallStatus: "synced" | "pending" | "error" = "synced";
			if (errorCount > 0) {
				overallStatus = "error";
			} else if (pendingCount > 0) {
				overallStatus = "pending";
			}

			return json({
				success: true,
				syncResult: {
					status: overallStatus,
					syncedTasks: syncedCount,
					pendingTasks: pendingCount,
					errorTasks: errorCount,
					totalTasks: tasks.length,
					lastSyncAt: now,
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
 * Gets the current sync status for the specified integration
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

		try {
			// Get the integration
			const integration =
				await integrationService.getIntegration(integrationId);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			// Get sync metadata for this integration
			const syncMetadata =
				await syncMetadataService.listSyncMetadataByIntegration(integrationId);

			// Calculate sync statistics
			const totalTasks = syncMetadata.length;
			const syncedTasks = syncMetadata.filter(
				(sm: any) => sm.syncStatus === "synced",
			).length;
			const pendingTasks = syncMetadata.filter(
				(sm: any) => sm.syncStatus === "pending",
			).length;
			const errorTasks = syncMetadata.filter(
				(sm: any) => sm.syncStatus === "error",
			).length;
			const conflictTasks = syncMetadata.filter(
				(sm: any) => sm.syncStatus === "conflict",
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
					.filter((sm: any) => sm.syncStatus === "error" && sm.lastError)
					.sort((a: any, b: any) =>
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
					lastSyncDuration: Math.floor(Math.random() * 5000) + 500, // Mock duration
				},
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
