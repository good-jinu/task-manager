import { TaskService, ValidationError } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * GET /api/tasks/[id]
 * Returns a specific task by ID
 */
export const GET: RequestHandler = async (event) => {
	try {
		const { id } = event.params;

		// Try to get authenticated user, but allow guest users
		let _userId: string;
		try {
			const session = await requireAuth(event);
			_userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			_userId = guestId;
		}

		const taskService = new TaskService();
		const task = await taskService.getTask(id);

		if (!task) {
			return json({ error: "Task not found" }, { status: 404 });
		}

		return json({
			success: true,
			data: task,
		});
	} catch (error) {
		console.error("Failed to get task:", error);
		return json({ error: "Failed to retrieve task" }, { status: 500 });
	}
};

/**
 * PUT /api/tasks/[id]
 * Updates a specific task by ID
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const { id } = event.params;
		const updateData = await event.request.json();

		// Try to get authenticated user, but allow guest users
		let _userId: string;
		try {
			const session = await requireAuth(event);
			_userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			_userId = guestId;
		}

		const taskService = new TaskService();
		const task = await taskService.updateTask(id, updateData);

		return json({
			success: true,
			data: task,
		});
	} catch (error) {
		console.error("Failed to update task:", error);

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "Task not found" }, { status: 404 });
		}

		return json({ error: "Failed to update task" }, { status: 500 });
	}
};

/**
 * DELETE /api/tasks/[id]
 * Deletes a specific task by ID
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const { id } = event.params;

		// Try to get authenticated user, but allow guest users
		let _userId: string;
		try {
			const session = await requireAuth(event);
			_userId = session.user.id;
		} catch {
			// Check for guest user ID in headers or cookies
			const guestId =
				event.request.headers.get("x-guest-id") ||
				event.cookies.get("guest-id");

			if (!guestId) {
				return json(
					{ error: "Authentication required or guest ID missing" },
					{ status: 401 },
				);
			}
			_userId = guestId;
		}

		const taskService = new TaskService();
		await taskService.deleteTask(id);

		return json({
			success: true,
			message: "Task deleted successfully",
		});
	} catch (error) {
		console.error("Failed to delete task:", error);

		if (error instanceof Error && error.message.includes("not found")) {
			return json({ error: "Task not found" }, { status: 404 });
		}

		return json({ error: "Failed to delete task" }, { status: 500 });
	}
};
