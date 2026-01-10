import {
	IntegrationService,
	SyncStatisticsService,
	ValidationError,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/integrations/[id]/sync/statistics
 * Gets comprehensive sync statistics and performance metrics for the specified integration
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		// Get query parameters
		const url = new URL(event.request.url);
		const days = parseInt(url.searchParams.get("days") || "7", 10);
		const includeHistory = url.searchParams.get("includeHistory") === "true";
		const historyLimit = parseInt(
			url.searchParams.get("historyLimit") || "50",
			10,
		);

		// Validate parameters
		if (days < 1 || days > 365) {
			return json(
				{ error: "Days parameter must be between 1 and 365" },
				{ status: 400 },
			);
		}

		if (historyLimit < 1 || historyLimit > 1000) {
			return json(
				{ error: "History limit must be between 1 and 1000" },
				{ status: 400 },
			);
		}

		const integrationService = new IntegrationService();
		const syncStatisticsService = new SyncStatisticsService();

		try {
			// Get the integration
			const integration =
				await integrationService.getIntegration(integrationId);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			// Get current sync statistics
			const statistics =
				await syncStatisticsService.getSyncStatistics(integrationId);

			// Get performance metrics
			const performanceMetrics =
				await syncStatisticsService.getSyncPerformanceMetrics(
					integrationId,
					days,
				);

			// Get sync history if requested
			let syncHistory = null;
			if (includeHistory) {
				const endTime = new Date();
				const startTime = new Date(
					endTime.getTime() - days * 24 * 60 * 60 * 1000,
				);
				syncHistory = await syncStatisticsService.getSyncHistory(
					integrationId,
					historyLimit,
					startTime,
					endTime,
				);
			}

			return json({
				integrationId,
				integration: {
					id: integration.id,
					provider: integration.provider,
					syncEnabled: integration.syncEnabled,
					lastSyncAt: integration.lastSyncAt,
				},
				statistics,
				performanceMetrics,
				syncHistory,
				metadata: {
					reportGeneratedAt: new Date().toISOString(),
					reportPeriodDays: days,
					includesHistory: includeHistory,
					historyEntries: syncHistory?.length || 0,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to get sync statistics:", error);

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
				error: "Failed to get sync statistics",
			},
			{ status: 500 },
		);
	}
};

/**
 * DELETE /api/integrations/[id]/sync/statistics
 * Resets sync statistics for the specified integration
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const integrationService = new IntegrationService();
		const syncStatisticsService = new SyncStatisticsService();

		try {
			// Get the integration
			const integration =
				await integrationService.getIntegration(integrationId);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			// Delete sync statistics
			await syncStatisticsService.deleteSyncStatistics(integrationId);

			return json({
				success: true,
				message: "Sync statistics reset successfully",
				integrationId,
				resetAt: new Date().toISOString(),
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to reset sync statistics:", error);

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
				error: "Failed to reset sync statistics",
			},
			{ status: 500 },
		);
	}
};
