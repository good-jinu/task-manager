import { getDatabaseClient } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		const updateData = await event.request.json();

		// Get database client and update task with ownership verification
		const db = getDatabaseClient();

		// Prepare update data, converting date strings to Date objects if needed
		const updates: any = {};
		if (updateData.title !== undefined) updates.title = updateData.title;
		if (updateData.description !== undefined)
			updates.description = updateData.description;
		if (updateData.status !== undefined) updates.status = updateData.status;
		if (updateData.priority !== undefined)
			updates.priority = updateData.priority;
		if (updateData.dueDate !== undefined) {
			updates.dueDate = updateData.dueDate
				? new Date(updateData.dueDate)
				: undefined;
		}
		if (updateData.assignee !== undefined)
			updates.assignee = updateData.assignee;
		if (updateData.tags !== undefined) updates.tags = updateData.tags;

		const dbTask = await db.tasks.updateTask(session.user.id, taskId, updates);

		// Convert Date objects to strings for client compatibility
		const task = {
			...dbTask,
			dueDate: dbTask.dueDate
				? dbTask.dueDate.toISOString().split("T")[0]
				: undefined,
			createdAt: dbTask.createdAt.toISOString(),
			updatedAt: dbTask.updatedAt.toISOString(),
		};

		return json({ task });
	} catch (error) {
		console.error("Failed to update task:", error);

		// Check if it's a task not found error (ownership validation failed)
		if (
			error instanceof Error &&
			error.message.includes("not found for user")
		) {
			return json(
				{ error: "Task not found or access denied" },
				{ status: 404 },
			);
		}

		return json({ error: "Failed to update task" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		// Get database client and delete task with ownership verification
		const db = getDatabaseClient();
		await db.tasks.deleteTask(session.user.id, taskId);

		return json({ success: true });
	} catch (error) {
		console.error("Failed to delete task:", error);

		// Check if it's a task not found error (ownership validation failed)
		if (
			error instanceof Error &&
			error.message.includes("not found for user")
		) {
			return json(
				{ error: "Task not found or access denied" },
				{ status: 404 },
			);
		}

		return json({ error: "Failed to delete task" }, { status: 500 });
	}
};
