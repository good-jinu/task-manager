import { z } from "zod";
import type { TaskToolCommonArgs } from "./create-task";

/**
 * Input schema for updating a task
 */
export const updateTaskInputSchema = z.object({
	taskId: z.string().min(1, "Task ID is required"),
	title: z.string().min(1).optional(),
	content: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	dueDate: z.string().optional(),
	status: z.enum(["todo", "in-progress", "done", "archived"]).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

/**
 * Execute task update
 */
export async function executeUpdateTask(
	args: TaskToolCommonArgs & { input: UpdateTaskInput },
) {
	const { taskService, input } = args;

	try {
		const { taskId, ...updates } = input;

		const task = await taskService.updateTask(taskId, updates);

		return {
			success: true,
			taskId: task.id,
			title: task.title,
			status: task.status,
			priority: task.priority,
			dueDate: task.dueDate,
			message: `Updated task: "${task.title}"`,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Failed to update task: ${errorMessage}`);
	}
}
