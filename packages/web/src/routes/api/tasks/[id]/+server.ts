import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { TaskService } from "@task-manager/db";
import { requireAuthOrGuest } from "$lib/auth/middleware";

const taskService = new TaskService();

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

		return json({ task });
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
