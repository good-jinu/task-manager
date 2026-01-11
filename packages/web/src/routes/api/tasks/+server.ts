import {
	type PaginatedResult,
	type Task,
	TaskService,
	type TaskStatus,
	ValidationError,
} from "@notion-task-manager/db";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireAuthOrGuest } from "$lib/auth/middleware";

/**
 * GET /api/tasks
 * Returns tasks for the authenticated user or guest user
 * Query parameters:
 * - workspaceId: string (required)
 * - status: TaskStatus (optional)
 * - limit: number (optional, default 50)
 * - cursor: string (optional, for pagination)
 */
export const GET = async (event: RequestEvent) => {
	try {
		const url = new URL(event.request.url);
		const workspaceId = url.searchParams.get("workspaceId");
		const status = url.searchParams.get("status") as TaskStatus | null;
		const limit = parseInt(url.searchParams.get("limit") || "50", 10);
		const cursor = url.searchParams.get("cursor") || undefined;

		if (!workspaceId) {
			return json({ error: "workspaceId is required" }, { status: 400 });
		}

		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const taskService = new TaskService();

		let result: PaginatedResult<Task>;
		if (status) {
			result = await taskService.listTasksByStatus(workspaceId, status, {
				limit,
				cursor,
			});
		} else {
			result = await taskService.listTasks(workspaceId, {
				limit,
				cursor,
			});
		}

		return json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("Failed to get tasks:", error);

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Check if error is already a Response (from middleware)
		if (error instanceof Response) {
			return error;
		}

		return json({ error: "Failed to retrieve tasks" }, { status: 500 });
	}
};

/**
 * POST /api/tasks
 * Creates a new task for the authenticated user or guest user
 */
export const POST = async (event: RequestEvent) => {
	try {
		const taskData = await event.request.json();

		// Use centralized auth middleware
		const { userId } = await requireAuthOrGuest(event);

		const taskService = new TaskService();
		const task = await taskService.createTask(taskData);

		return json(
			{
				success: true,
				data: task,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Failed to create task:", error);

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Check if error is already a Response (from middleware)
		if (error instanceof Response) {
			return error;
		}

		return json({ error: "Failed to create task" }, { status: 500 });
	}
};
