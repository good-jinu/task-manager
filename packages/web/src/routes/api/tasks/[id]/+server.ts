import { TaskService } from "@notion-task-manager/db";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";

const taskService = new TaskService();

export const GET = async (event: RequestEvent) => {
	try {
		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		// Check authentication (guest or authenticated user)
		let userId: string;
		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			userId = session.user.id;
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
			userId = guestId;
		}

		const task = await taskService.getTask(taskId);

		if (!task) {
			return json({ error: "Task not found" }, { status: 404 });
		}

		return json({ task });
	} catch (error) {
		console.error("Failed to get task:", error);
		return json({ error: "Failed to get task" }, { status: 500 });
	}
};

export const PUT = async (event: RequestEvent) => {
	try {
		const taskId = event.params.id;
		if (!taskId) {
			return json({ error: "Task ID is required" }, { status: 400 });
		}

		// Check authentication (guest or authenticated user)
		let userId: string;
		try {
			const session = await event.locals.auth();
			if (!session?.user || !session.user.id) {
				throw new Error("Not authenticated");
			}
			userId = session.user.id;
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
			userId = guestId;
		}

		const updateData = await event.request.json();
		const updatedTask = await taskService.updateTask(taskId, updateData);

		return json({ task: updatedTask });
	} catch (error) {
		console.error("Failed to update task:", error);
		return json({ error: "Failed to update task" }, { status: 500 });
	}
};
