import { fail } from "@sveltejs/kit";
import {
	type TaskFilter,
	type TaskPriority,
	TaskStatus,
	taskService,
} from "$lib/notion";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
	try {
		const status = url.searchParams.get("status");
		const priority = url.searchParams.get("priority");

		const filter: TaskFilter = {};

		if (status) {
			filter.status = [status as TaskStatus];
		}

		if (priority) {
			filter.priority = [priority as TaskPriority];
		}

		const tasks = await taskService.getTasks(
			Object.keys(filter).length > 0 ? filter : undefined,
		);

		return {
			tasks,
		};
	} catch (error) {
		console.error("Failed to load tasks:", error);
		return {
			tasks: [],
		};
	}
};

export const actions: Actions = {
	create: async ({ request }) => {
		try {
			const data = await request.formData();

			const title = data.get("title") as string;
			const description = data.get("description") as string;
			const status = (data.get("status") as TaskStatus) || TaskStatus.TODO;
			const priority = data.get("priority") as TaskPriority;
			const dueDate = data.get("dueDate") as string;
			const assignee = data.get("assignee") as string;
			const tags = data.get("tags") as string;

			if (!title) {
				return fail(400, { error: "Title is required" });
			}

			await taskService.createTask({
				title,
				description: description || undefined,
				status,
				priority: priority || undefined,
				dueDate: dueDate ? new Date(dueDate) : undefined,
				assignee: assignee || undefined,
				tags: tags ? tags.split(",").map((tag) => tag.trim()) : undefined,
			});

			return { success: true };
		} catch (error) {
			console.error("Failed to create task:", error);
			return fail(500, { error: "Failed to create task" });
		}
	},

	updateStatus: async ({ request }) => {
		try {
			const data = await request.formData();
			const taskId = data.get("taskId") as string;
			const status = data.get("status") as TaskStatus;

			if (!taskId || !status) {
				return fail(400, { error: "Task ID and status are required" });
			}

			await taskService.updateTask(taskId, { status });

			return { success: true };
		} catch (error) {
			console.error("Failed to update task:", error);
			return fail(500, { error: "Failed to update task" });
		}
	},

	delete: async ({ request }) => {
		try {
			const data = await request.formData();
			const taskId = data.get("taskId") as string;

			if (!taskId) {
				return fail(400, { error: "Task ID is required" });
			}

			await taskService.deleteTask(taskId);

			return { success: true };
		} catch (error) {
			console.error("Failed to delete task:", error);
			return fail(500, { error: "Failed to delete task" });
		}
	},
};
