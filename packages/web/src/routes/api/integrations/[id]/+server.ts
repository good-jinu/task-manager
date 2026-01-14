import { json } from "@sveltejs/kit";
import {
	TaskIntegrationService,
	ValidationError,
	WorkspaceIntegrationService,
} from "@task-manager/db";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/integrations/[id]
 * Gets a specific workspace integration by ID
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const workspaceIntegrationService = new WorkspaceIntegrationService();
		const integration =
			await workspaceIntegrationService.getById(integrationId);

		if (!integration) {
			return json(
				{ error: "Workspace integration not found" },
				{ status: 404 },
			);
		}

		return json({ integration });
	} catch (error) {
		console.error("Failed to get workspace integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to get workspace integration",
			},
			{ status: 500 },
		);
	}
};

/**
 * PATCH /api/integrations/[id]
 * Updates an existing workspace integration
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const body = await event.request.json();

		// Ensure the workspace integration exists
		const workspaceIntegrationService = new WorkspaceIntegrationService();
		const existing = await workspaceIntegrationService.getById(integrationId);

		if (!existing) {
			return json(
				{ error: "Workspace integration not found" },
				{ status: 404 },
			);
		}

		// Perform the update
		const updatedIntegration = await workspaceIntegrationService.update(
			integrationId,
			body,
		);

		return json({
			success: true,
			integration: updatedIntegration,
		});
	} catch (error) {
		console.error("Failed to patch workspace integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
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
				error: "Failed to update workspace integration",
			},
			{ status: 500 },
		);
	}
};

/**
 * DELETE /api/integrations/[id]
 * Deletes a workspace integration
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const integrationId = event.params.id;
		if (!integrationId) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		const workspaceIntegrationService = new WorkspaceIntegrationService();

		try {
			// First, verify the workspace integration exists
			const integration =
				await workspaceIntegrationService.getById(integrationId);
			if (!integration) {
				return json(
					{ error: "Workspace integration not found" },
					{ status: 404 },
				);
			}

			// Delete the workspace integration
			await workspaceIntegrationService.delete(integrationId);

			return json({
				success: true,
				message: "Workspace integration deleted successfully",
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return json(
					{ error: "Workspace integration not found" },
					{ status: 404 },
				);
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to delete workspace integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to delete workspace integration",
			},
			{ status: 500 },
		);
	}
};
