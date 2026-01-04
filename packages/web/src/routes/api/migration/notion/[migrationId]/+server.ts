import {
	IntegrationService,
	MigrationService,
	SyncMetadataService,
	TaskService,
	WorkspaceService,
} from "@notion-task-manager/db";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import { createNotionTaskManagerWithAuth } from "$lib/notion";
import { getUserFromDatabase } from "$lib/user";

/**
 * GET /api/migration/notion/[migrationId]
 * Gets the progress of a specific Notion migration
 */
export const GET = async (event: RequestEvent) => {
	try {
		const { migrationId } = event.params;

		if (!migrationId) {
			return json({ error: "Migration ID is required" }, { status: 400 });
		}

		// Require authentication for migration operations
		const session = await requireAuth(event);

		// Get user data to access Notion tokens
		const user = await getUserFromDatabase(session.user.id);
		if (!user) {
			return json({ error: "User not found in database" }, { status: 404 });
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
		const progress = await migrationService.getMigrationProgress(migrationId);

		if (!progress) {
			return json({ error: "Migration not found" }, { status: 404 });
		}

		return json({
			success: true,
			data: progress,
		});
	} catch (error) {
		console.error("Failed to get migration progress:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{ error: "Failed to retrieve migration progress" },
			{ status: 500 },
		);
	}
};
