import {
	IntegrationService,
	SyncMetadataService,
	SyncService,
	type SyncTimingOptions,
	TaskService,
	ValidationError,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/integrations/[id]/sync/config
 * Gets the sync timing configuration for the specified integration
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
		const syncService = new SyncService(
			new SyncMetadataService(),
			new TaskService(),
			integrationService,
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

			return json({
				integrationId,
				timingOptions,
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to get sync config:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get sync config",
			},
			{ status: 500 },
		);
	}
};

/**
 * PUT /api/integrations/[id]/sync/config
 * Updates the sync timing configuration for the specified integration
 */
export const PUT: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const updates = await event.request.json();

		// Validate the updates
		const validFields = [
			"autoSync",
			"syncInterval",
			"manualSyncEnabled",
			"conflictResolution",
		];
		const filteredUpdates: Partial<SyncTimingOptions> = {};

		for (const [key, value] of Object.entries(updates)) {
			if (validFields.includes(key)) {
				const typedKey = key as keyof SyncTimingOptions;
				if (value !== undefined) {
					(filteredUpdates as any)[typedKey] = value;
				}
			}
		}

		// Validate specific fields
		if (filteredUpdates.syncInterval !== undefined) {
			if (
				typeof filteredUpdates.syncInterval !== "number" ||
				filteredUpdates.syncInterval < 10
			) {
				return json(
					{ error: "Sync interval must be a number >= 10 seconds" },
					{ status: 400 },
				);
			}
		}

		if (filteredUpdates.conflictResolution !== undefined) {
			const validStrategies = ["internal-wins", "external-wins", "manual"];
			if (!validStrategies.includes(filteredUpdates.conflictResolution)) {
				return json(
					{
						error: `Conflict resolution must be one of: ${validStrategies.join(", ")}`,
					},
					{ status: 400 },
				);
			}
		}

		const integrationService = new IntegrationService();
		const syncService = new SyncService(
			new SyncMetadataService(),
			new TaskService(),
			integrationService,
		);

		try {
			// Get the integration
			const integration =
				await integrationService.getIntegration(integrationId);
			if (!integration) {
				return json({ error: "Integration not found" }, { status: 404 });
			}

			// Update sync timing options
			await syncService.updateSyncTimingOptions(integrationId, filteredUpdates);

			// Get updated timing options
			const updatedTimingOptions =
				await syncService.getSyncTimingOptions(integrationId);

			return json({
				success: true,
				integrationId,
				timingOptions: updatedTimingOptions,
				updatedFields: Object.keys(filteredUpdates),
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to update sync config:", error);

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
				error: "Failed to update sync config",
			},
			{ status: 500 },
		);
	}
};
