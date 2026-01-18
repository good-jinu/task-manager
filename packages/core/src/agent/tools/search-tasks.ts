import { z } from "zod";
import type { TaskToolCommonArgs } from "./task-common";

/**
 * Input schema for searching tasks
 */
export const searchTasksInputSchema = z.object({
	query: z.array(z.string()).min(1, "At least one search term is required"),
	status: z.enum(["todo", "in-progress", "done", "archived"]).optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	limit: z.number().min(1).max(50).optional(),
});

export type SearchTasksInput = z.infer<typeof searchTasksInputSchema>;

/**
 * Execute task search
 */
export async function executeSearchTasks(
	args: TaskToolCommonArgs & { input: SearchTasksInput },
) {
	console.log("[executeSearchTasks] Starting search:", args.input);
	const { workspaceId, taskService, input } = args;

	try {
		const { query, status, priority, limit = 20 } = input;
		console.log("[executeSearchTasks] Search parameters:", {
			query,
			status,
			priority,
			limit,
			workspaceId,
		});

		// Get all tasks and filter based on criteria
		console.log("[executeSearchTasks] Fetching all tasks from workspace");
		const allTasks = await taskService.listTasks(workspaceId, { limit: 100 });
		console.log("[executeSearchTasks] Fetched tasks:", allTasks.items.length);

		let filteredTasks = allTasks.items;

		// Apply search terms filter
		if (query.length > 0) {
			console.log("[executeSearchTasks] Applying search terms filter");
			const searchTerms = query.map((term) => term.toLowerCase());
			filteredTasks = filteredTasks.filter((task) =>
				searchTerms.some(
					(term) =>
						task.title.toLowerCase().includes(term) ||
						task.content?.toLowerCase().includes(term),
				),
			);
			console.log(
				"[executeSearchTasks] After search filter:",
				filteredTasks.length,
			);
		}

		// Apply status filter
		if (status) {
			console.log("[executeSearchTasks] Applying status filter:", status);
			filteredTasks = filteredTasks.filter((task) => task.status === status);
			console.log(
				"[executeSearchTasks] After status filter:",
				filteredTasks.length,
			);
		}

		// Apply priority filter
		if (priority) {
			console.log("[executeSearchTasks] Applying priority filter:", priority);
			filteredTasks = filteredTasks.filter(
				(task) => task.priority === priority,
			);
			console.log(
				"[executeSearchTasks] After priority filter:",
				filteredTasks.length,
			);
		}

		// Limit results
		const results = filteredTasks.slice(0, limit);
		console.log("[executeSearchTasks] Final results count:", results.length);

		const response = {
			success: true,
			tasks: results.map((task) => ({
				id: task.id,
				title: task.title,
				content: task.content,
				status: task.status,
				priority: task.priority,
				dueDate: task.dueDate,
				createdAt: task.createdAt,
				updatedAt: task.updatedAt,
			})),
			totalFound: results.length,
			message:
				results.length > 0
					? `Found ${results.length} task${results.length > 1 ? "s" : ""} matching your search`
					: "No tasks found matching your criteria",
		};

		console.log(
			"[executeSearchTasks] Search completed successfully:",
			response.message,
		);
		return response;
	} catch (error) {
		console.error("[executeSearchTasks] Search failed:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Failed to search tasks: ${errorMessage}`);
	}
}
