import { WorkspaceService } from "@notion-task-manager/db";
import { handleGet, handlePost } from "$lib/server";
import type { RequestHandler } from "./$types";

/**
 * GET /api/workspaces
 * Returns all workspaces for the authenticated user or guest user
 */
export const GET: RequestHandler = async (event) => {
	return handleGet(
		event,
		async (_event, authResult) => {
			const workspaceService = new WorkspaceService();
			const workspaces = await workspaceService.listWorkspaces(
				authResult.userId,
			);

			return {
				success: true,
				workspaces,
			};
		},
		{ allowGuest: true },
	);
};

/**
 * POST /api/workspaces
 * Creates a new workspace for the authenticated user or guest user
 */
export const POST: RequestHandler = async (event) => {
	return handlePost(
		event,
		async (event, authResult) => {
			const workspaceData = await event.request.json();
			const workspaceService = new WorkspaceService();
			const workspace = await workspaceService.createWorkspace(
				authResult.userId,
				workspaceData,
			);

			return {
				success: true,
				data: workspace,
			};
		},
		{ allowGuest: true },
	);
};
