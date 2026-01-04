import {
	IntegrationService,
	ValidationError,
	WorkspaceService,
} from "@notion-task-manager/db";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";

/**
 * GET /api/integrations/[id]
 * Returns a specific integration by ID
 */
export const GET = async (event: RequestEvent) => {
	try {
		const { id } = event.params;

		if (!id) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		// Require authentication for integration operations
		const session = await requireAuth(event);

		const integrationService = new IntegrationService();
		const integration = await integrationService.getIntegration(id);

		if (!integration) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		// Verify user owns the workspace that contains this integration
		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.getWorkspace(
			integration.workspaceId,
		);

		if (!workspace || workspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		return json({
			success: true,
			data: integration,
		});
	} catch (error) {
		console.error("Failed to get integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json({ error: "Failed to retrieve integration" }, { status: 500 });
	}
};

/**
 * PUT /api/integrations/[id]
 * Updates a specific integration by ID
 */
export const PUT = async (event: RequestEvent) => {
	try {
		const { id } = event.params;
		const updateData = await event.request.json();

		if (!id) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		// Require authentication for integration operations
		const session = await requireAuth(event);

		const integrationService = new IntegrationService();

		// First check if integration exists and user owns the workspace
		const existingIntegration = await integrationService.getIntegration(id);
		if (!existingIntegration) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.getWorkspace(
			existingIntegration.workspaceId,
		);

		if (!workspace || workspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		const integration = await integrationService.updateIntegration(
			id,
			updateData,
		);

		return json({
			success: true,
			data: integration,
		});
	} catch (error) {
		console.error("Failed to update integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		return json({ error: "Failed to update integration" }, { status: 500 });
	}
};

/**
 * DELETE /api/integrations/[id]
 * Deletes a specific integration by ID
 */
export const DELETE = async (event: RequestEvent) => {
	try {
		const { id } = event.params;

		if (!id) {
			return json({ error: "Integration ID is required" }, { status: 400 });
		}

		// Require authentication for integration operations
		const session = await requireAuth(event);

		const integrationService = new IntegrationService();

		// First check if integration exists and user owns the workspace
		const existingIntegration = await integrationService.getIntegration(id);
		if (!existingIntegration) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.getWorkspace(
			existingIntegration.workspaceId,
		);

		if (!workspace || workspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		await integrationService.deleteIntegration(id);

		return json({
			success: true,
			message: "Integration deleted successfully",
		});
	} catch (error) {
		console.error("Failed to delete integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "Integration not found" }, { status: 404 });
		}

		return json({ error: "Failed to delete integration" }, { status: 500 });
	}
};
