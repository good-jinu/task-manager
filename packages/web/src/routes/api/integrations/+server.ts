import {
	IntegrationService,
	ValidationError,
	WorkspaceService,
} from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/integrations
 * Returns integrations for a specific workspace
 * Query parameters:
 * - workspaceId: string (required)
 */
export const GET: RequestHandler = async (event) => {
	try {
		const url = new URL(event.request.url);
		const workspaceId = url.searchParams.get("workspaceId");

		if (!workspaceId) {
			return json({ error: "workspaceId is required" }, { status: 400 });
		}

		// Require authentication for integration operations
		const session = await requireAuth(event);

		// Verify user owns the workspace
		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.getWorkspace(workspaceId);

		if (!workspace) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		if (workspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		const integrationService = new IntegrationService();
		const integrations = await integrationService.listIntegrations(workspaceId);

		return json({
			success: true,
			data: integrations,
		});
	} catch (error) {
		console.error("Failed to get integrations:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json({ error: "Failed to retrieve integrations" }, { status: 500 });
	}
};

/**
 * POST /api/integrations
 * Creates a new integration for a workspace
 */
export const POST: RequestHandler = async (event) => {
	try {
		const integrationData = await event.request.json();
		const { workspaceId } = integrationData;

		if (!workspaceId) {
			return json({ error: "workspaceId is required" }, { status: 400 });
		}

		// Require authentication for integration operations
		const session = await requireAuth(event);

		// Verify user owns the workspace
		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.getWorkspace(workspaceId);

		if (!workspace) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		if (workspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		const integrationService = new IntegrationService();
		const integration = await integrationService.createIntegration(
			workspaceId,
			integrationData,
		);

		return json(
			{
				success: true,
				data: integration,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to create integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof Error && error.message.includes("already exists")) {
			return json(
				{ error: "Integration already exists for this provider" },
				{ status: 409 },
			);
		}

		return json({ error: "Failed to create integration" }, { status: 500 });
	}
};
