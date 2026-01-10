import { z } from "zod";
import type { TaskToolCommonArgs } from "./create-task";

/**
 * Input schema for getting a task
 */
export const getTaskInputSchema = z.object({
	taskId: z.string().min(1, "Task ID is required"),
});

export type GetTaskInput = z.infer<typeof getTaskInputSchema>;

/**
 * Execute task retrieval
 */
export async function executeGetTask(
	args: TaskToolCommonArgs & { input: GetTaskInput },
) {
	const { taskService, input } = args;

	try {
		const task = await taskService.getTask(input.taskId);

		if (!task) {
			return {
				success: false,
				message: `Task with ID ${input.taskId} not found`,
			};
		}

		return {
			success: true,
			task: {
				id: task.id,
				title: task.title,
				content: task.content,
				status: task.status,
				priority: task.priority,
				dueDate: task.dueDate,
				createdAt: task.createdAt,
				updatedAt: task.updatedAt,
			},
			message: `Retrieved task: "${task.title}"`,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Failed to get task: ${errorMessage}`);
	}
}
