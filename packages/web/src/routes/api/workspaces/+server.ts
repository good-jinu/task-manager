import { ValidationError, WorkspaceService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/workspaces
 * Returns all workspaces for the authenticated user
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication for workspace operations
		const session = await requireAuth(event);

		const workspaceService = new WorkspaceService();
		const workspaces = await workspaceService.listWorkspaces(session.user.id);

		return json({
			success: true,
			data: workspaces,
		});
	} catch (error) {
		console.error("Failed to get workspaces:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json({ error: "Failed to retrieve workspaces" }, { status: 500 });
	}
};

/**
 * POST /api/workspaces
 * Creates a new workspace for the authenticated user
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Require authentication for workspace operations
		const session = await requireAuth(event);
		const workspaceData = await event.request.json();

		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.createWorkspace(
			session.user.id,
			workspaceData,
		);

		return json(
			{
				success: true,
				data: workspace,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to create workspace:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: "Failed to create workspace" }, { status: 500 });
	}
};
