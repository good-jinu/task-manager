import { json } from "@sveltejs/kit";
import {
	TaskIntegrationService,
	TaskService,
	ValidationError,
} from "@task-manager/db";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * PUT /api/integrations/[id]/sync
 * Triggers a manual sync for the specified integration (simplified version)
 */
export const PUT: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		// For now, just return a success response
		// In the future, this would trigger actual sync logic
		return json({
			success: true,
			message: "Sync functionality will be implemented in the future",
			syncResult: {
				status: "not_implemented",
				triggeredAt: new Date().toISOString(),
			},
		});
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
 * Gets basic integration status (simplified version)
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const taskIntegrationService = new TaskIntegrationService();
		const taskService = new TaskService();

		// Get basic integration info by checking if any tasks have integrations
		// This is a simplified approach - in the future you might want to store
		// integration configuration separately

		return json({
			syncStatus: {
				status: "disconnected",
				lastSyncAt: null,
				lastError: null,
				syncCount: 0,
				conflictCount: 0,
			},
			syncStats: {
				totalTasks: 0,
				syncedTasks: 0,
				pendingTasks: 0,
				errorTasks: 0,
				lastSyncDuration: null,
			},
			message: "Sync functionality will be implemented in the future",
		});
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
