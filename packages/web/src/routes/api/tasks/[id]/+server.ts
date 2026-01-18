import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import {
	createNotionTaskManagerWithAuth,
	NotionAdapter,
	TaskIntegrationService,
	TaskService,
	UserService,
	WorkspaceIntegrationService,
} from "@task-manager/db";
import { requireAuthOrGuest } from "$lib/auth/middleware";

const taskService = new TaskService();
const taskIntegrationService = new TaskIntegrationService();
const workspaceIntegrationService = new WorkspaceIntegrationService();
const userService = new UserService();

export const GET = async (event: RequestEvent) => {
	try {
		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const task = await taskService.getTask(taskId);

		if (!task) {
			return json({ error: "Task not found" }, { status: 404 });
		}

		// Check if task has Notion integration
		let notionPageUrl: string | null = null;
		try {
			const integration = await taskIntegrationService.getByTaskId(taskId);
			if (integration && integration.provider === "notion") {
				// Construct Notion page URL from page ID
				// Format: https://notion.so/{pageId}
				const pageId = integration.externalId.replace(/-/g, "");
				notionPageUrl = `https://notion.so/${pageId}`;
			}
		} catch (error) {
			console.error("Failed to get task integration:", error);
			// Continue without integration data
		}

		return json({ task, notionPageUrl });
	} catch (error) {
		console.error("Failed to get task:", error);

		// Check if error is already a Response (from middleware)
		if (error instanceof Response) {
			return error;
		}

		return json({ error: "Failed to get task" }, { status: 500 });
	}
};

export const PUT = async (event: RequestEvent) => {
	try {
		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const updateData = await event.request.json();
		const updatedTask = await taskService.updateTask(taskId, updateData);

		// Sync to Notion if integration exists
		try {
			await syncTaskToNotion(userId, updatedTask.workspaceId, taskId);
		} catch (notionError) {
			console.error(
				"[PUT /api/tasks/[id]] Failed to sync to Notion:",
				notionError,
			);
			// Don't fail the request if Notion sync fails
		}

		return json({ task: updatedTask });
	} catch (error) {
		console.error("Failed to update task:", error);

		// Check if error is already a Response (from middleware)
		if (error instanceof Response) {
			return error;
		}

		return json({ error: "Failed to update task" }, { status: 500 });
	}
};

export const PATCH = async (event: RequestEvent) => {
	// PATCH uses the same logic as PUT for partial updates
	return PUT(event);
};

export const DELETE = async (event: RequestEvent) => {
	try {
		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		await taskService.deleteTask(taskId);

		return json({ success: true });
	} catch (error) {
		console.error("Failed to delete task:", error);

		// Check if error is already a Response (from middleware)
		if (error instanceof Response) {
			return error;
		}

		return json({ error: "Failed to delete task" }, { status: 500 });
	}
};

/**
 * Sync task update to Notion if integration is enabled
 */
async function syncTaskToNotion(
	userId: string,
	workspaceId: string,
	taskId: string,
): Promise<void> {
	console.log("[syncTaskToNotion] Checking for Notion integration:", {
		userId,
		workspaceId,
		taskId,
	});

	// Check if Notion integration is enabled for this workspace
	const notionIntegration =
		await workspaceIntegrationService.findByWorkspaceAndProvider(
			workspaceId,
			"notion",
		);

	if (!notionIntegration?.syncEnabled) {
		console.log("[syncTaskToNotion] Notion integration not enabled");
		return;
	}

	console.log("[syncTaskToNotion] Notion integration found:", {
		integrationId: notionIntegration.id,
		databaseId: notionIntegration.config.databaseId,
	});

	// Check if task has Notion integration
	const taskIntegration = await taskIntegrationService.getByTaskId(taskId);
	if (!taskIntegration || taskIntegration.provider !== "notion") {
		console.log("[syncTaskToNotion] Task not linked to Notion");
		return;
	}

	console.log("[syncTaskToNotion] Task has Notion integration:", {
		notionPageId: taskIntegration.externalId,
	});

	// Get user to create Notion client
	const user = await userService.getUserById(userId);
	if (!user) {
		console.warn("[syncTaskToNotion] User not found");
		return;
	}

	// Get OAuth credentials from environment
	const clientId = process.env.AUTH_NOTION_ID;
	const clientSecret = process.env.AUTH_NOTION_SECRET;

	if (!clientId || !clientSecret) {
		console.error("[syncTaskToNotion] Notion OAuth credentials not configured");
		return;
	}

	// Create Notion adapter
	const notionTaskManager = createNotionTaskManagerWithAuth(
		user,
		clientId,
		clientSecret,
	);
	const notionAdapter = new NotionAdapter(notionTaskManager);

	// Get the full task details
	const task = await taskService.getTask(taskId);
	if (!task) {
		console.warn("[syncTaskToNotion] Task not found:", taskId);
		return;
	}

	// Update Notion page
	console.log("[syncTaskToNotion] Updating Notion page:", {
		notionPageId: taskIntegration.externalId,
		title: task.title,
		hasContent: !!task.content,
	});

	await notionAdapter.updateTask(taskIntegration.externalId, {
		title: task.title,
		content: task.content || "",
	});

	console.log("[syncTaskToNotion] Notion page updated successfully");
}
