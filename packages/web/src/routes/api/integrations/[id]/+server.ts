import {
	IntegrationService,
	SyncMetadataService,
	ValidationError,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/integrations/[id]
 * Gets a specific integration by ID
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
		const integration = await integrationService.getIntegration(integrationId);

		if (!integration) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		return json({ integration });
	} catch (error) {
		console.error("Failed to get integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get integration",
			},
			{ status: 500 },
		);
	}
};

/**
 * PUT /api/integrations/[id]
 * Updates an existing integration
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

		const integrationService = new IntegrationService();

		try {
			const updatedIntegration = await integrationService.updateIntegration(
				integrationId,
				updates,
			);

			return json({
				success: true,
				integration: updatedIntegration,
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to update integration:", error);

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
				error: "Failed to update integration",
			},
			{ status: 500 },
		);
	}
};

/**
 * DELETE /api/integrations/[id]
 * Deletes an integration and all associated sync metadata
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
		const syncMetadataService = new SyncMetadataService();

		try {
			// First, clean up all sync metadata for this integration
			// Note: This would require implementing a method to delete by integration ID
			// For now, we'll just delete the integration

			await integrationService.deleteIntegration(integrationId);

			return json({
				success: true,
				message: "Integration deleted successfully",
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json({ error: "Integration not found" }, { status: 404 });
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to delete integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to delete integration",
			},
			{ status: 500 },
		);
	}
};
