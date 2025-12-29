import { getDatabaseClient } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		// Get database client and fetch user's tasks
		const db = getDatabaseClient();
		const dbTasks = await db.tasks.getTasksByUser(session.user.id);

		// Convert Date objects to strings for client compatibility
		const tasks = dbTasks.map((task) => ({
			...task,
			dueDate: task.dueDate
				? task.dueDate.toISOString().split("T")[0]
				: undefined,
			createdAt: task.createdAt.toISOString(),
			updatedAt: task.updatedAt.toISOString(),
		}));

		return json({ tasks });
	} catch (error) {
		console.error("Failed to fetch tasks:", error);
		return json({ error: "Failed to fetch tasks" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		// Ensure user is authenticated
		const session = await requireAuth(event);

		const taskData = await event.request.json();

		// Validate required fields
		if (!taskData.title || typeof taskData.title !== "string") {
			return json({ error: "Title is required" }, { status: 400 });
		}

		// Get database client and create task for authenticated user
		const db = getDatabaseClient();
		const dbTask = await db.tasks.createTask(session.user.id, {
			title: taskData.title,
			description: taskData.description,
			status: taskData.status,
			priority: taskData.priority,
			dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
			assignee: taskData.assignee,
			tags: taskData.tags,
		});

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
		console.error("Failed to create task:", error);
		return json({ error: "Failed to create task" }, { status: 500 });
	}
};
