import { getDatabaseClient } from "@notion-task-manager/db";
import { requireAuth } from "$lib/auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	// Ensure user is authenticated
	const session = await requireAuth(event);

	try {
		// Get database client and load user's tasks
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

		return {
			session,
			tasks,
		};
	} catch (error) {
		console.error("Failed to load tasks:", error);
		// Return empty tasks array on error to prevent page crash
		return {
			session,
			tasks: [],
			error: "Failed to load tasks",
		};
	}
};
