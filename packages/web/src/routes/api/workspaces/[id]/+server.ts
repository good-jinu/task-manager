import { ValidationError, WorkspaceService } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/workspaces/[id]
 * Returns a specific workspace by ID
 */
export const GET: RequestHandler = async (event) => {
	try {
		const { id } = event.params;

		// Require authentication for workspace operations
		const session = await requireAuth(event);

		const workspaceService = new WorkspaceService();
		const workspace = await workspaceService.getWorkspace(id);

		if (!workspace) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		// Ensure user owns this workspace
		if (workspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		return json({
			success: true,
			data: workspace,
		});
	} catch (error) {
		console.error("Failed to get workspace:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json({ error: "Failed to retrieve workspace" }, { status: 500 });
	}
};

/**
 * PUT /api/workspaces/[id]
 * Updates a specific workspace by ID
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const { id } = event.params;
		const updateData = await event.request.json();

		// Require authentication for workspace operations
		const session = await requireAuth(event);

		const workspaceService = new WorkspaceService();

		// First check if workspace exists and user owns it
		const existingWorkspace = await workspaceService.getWorkspace(id);
		if (!existingWorkspace) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		if (existingWorkspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		const workspace = await workspaceService.updateWorkspace(id, updateData);

		return json({
			success: true,
			data: workspace,
		});
	} catch (error) {
		console.error("Failed to update workspace:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		return json({ error: "Failed to update workspace" }, { status: 500 });
	}
};

/**
 * DELETE /api/workspaces/[id]
 * Deletes a specific workspace by ID
 * Query parameters:
 * - taskPolicy: 'archive' | 'delete' (optional, default 'archive')
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const { id } = event.params;
		const url = new URL(event.request.url);
		const taskPolicy =
			(url.searchParams.get("taskPolicy") as "archive" | "delete") || "archive";

		// Require authentication for workspace operations
		const session = await requireAuth(event);

		const workspaceService = new WorkspaceService();

		// First check if workspace exists and user owns it
		const existingWorkspace = await workspaceService.getWorkspace(id);
		if (!existingWorkspace) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		if (existingWorkspace.userId !== session.user.id) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		await workspaceService.deleteWorkspace(id, taskPolicy);

		return json({
			success: true,
			message: "Workspace deleted successfully",
		});
	} catch (error) {
		console.error("Failed to delete workspace:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "Workspace not found" }, { status: 404 });
		}

		return json({ error: "Failed to delete workspace" }, { status: 500 });
	}
};
