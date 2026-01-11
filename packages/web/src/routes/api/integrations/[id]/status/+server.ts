import { TaskIntegrationService, TaskService } from "@notion-task-manager/db";
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
 * Gets status for a task integration (simplified version)
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		const taskIntegrationService = new TaskIntegrationService();

		// Get task integration
		const integration = await taskIntegrationService.getByTaskId(taskId);

		// Determine status
		let status: IntegrationStatus["status"] = "disconnected";

		if (integration) {
			// For now, just return basic status
			// In the future, this would check actual sync status
			status = "synced";
		}

		// Get basic statistics
		const syncStats: SyncStatistics = {
			totalTasks: integration ? 1 : 0,
			syncedTasks: integration ? 1 : 0,
			pendingTasks: 0,
			errorTasks: 0,
		};

		// Cache the result for a short time
		event.setHeaders({
			"Cache-Control": "private, max-age=30", // 30 seconds
		});

		return json({
			status: {
				status,
				lastSyncAt: integration?.updatedAt
					? new Date(integration.updatedAt)
					: undefined,
				lastError: undefined,
				syncCount: integration ? 1 : 0,
				conflictCount: 0,
			} as IntegrationStatus,
			statistics: syncStats,
			integration: integration
				? {
						taskId: integration.taskId,
						provider: integration.provider,
						externalId: integration.externalId,
						createdAt: integration.createdAt,
					}
				: null,
		});
	} catch (error) {
		console.error("Failed to get task integration status:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get task integration status",
			},
			{ status: 500 },
		);
	}
};
