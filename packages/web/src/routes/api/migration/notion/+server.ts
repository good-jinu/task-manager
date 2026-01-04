import {
	IntegrationService,
	MigrationService,
	SyncMetadataService,
	TaskService,
	ValidationError,
	WorkspaceService,
} from "@notion-task-manager/db";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";

/**
 * POST /api/migration/notion
 * Imports tasks from a Notion database into a workspace
 * Request body: {
 *   notionDatabaseId: string,
 *   targetWorkspaceId?: string
 * }
 */
export const POST = async (event: RequestEvent) => {
	try {
		// Require authentication for migration operations
		const session = await requireAuth(event);

		// Get user data to access Notion tokens
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
		}

		const { notionDatabaseId, targetWorkspaceId } = await event.request.json();

		if (!notionDatabaseId) {
			return json({ error: "notionDatabaseId is required" }, { status: 400 });
		}

		// If targetWorkspaceId is provided, verify user owns it
		if (targetWorkspaceId) {
			const workspaceService = new WorkspaceService();
			const workspace = await workspaceService.getWorkspace(targetWorkspaceId);

			if (!workspace) {
				return json({ error: "Target workspace not found" }, { status: 404 });
			}

			if (workspace.userId !== session.user.id) {
				return json(
					{ error: "Access denied to target workspace" },
					{ status: 403 },
				);
			}
		}

		// Create Notion client with user's auth tokens
		const notionTaskManager = createNotionTaskManagerWithAuth(user);

		const migrationService = new MigrationService(
			notionTaskManager,
			new TaskService(),
			new WorkspaceService(),
			new SyncMetadataService(),
			new IntegrationService(),
		);
		const migrationResult = await migrationService.importFromNotion(
			session.user.id,
			notionDatabaseId,
			targetWorkspaceId,
		);

		return json(
			{
				success: true,
				data: migrationResult,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to import from Notion:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof Error && error.message.includes("access")) {
			return json(
				{
					error: "Unable to access Notion database. Please check permissions.",
				},
				{ status: 403 },
			);
		}

		return json({ error: "Failed to import from Notion" }, { status: 500 });
	}
};
