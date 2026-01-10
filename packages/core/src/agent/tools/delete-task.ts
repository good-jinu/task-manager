import { z } from "zod";
import type { TaskToolCommonArgs } from "./create-task";

/**
 * Input schema for deleting a task
 */
export const deleteTaskInputSchema = z.object({
	taskId: z.string().min(1, "Task ID is required"),
});

export type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>;

/**
 * Execute task deletion
 */
export async function executeDeleteTask(
	args: TaskToolCommonArgs & { input: DeleteTaskInput },
) {
	const { taskService, input } = args;

	try {
		// Get task details before deletion for the response
		const task = await taskService.getTask(input.taskId);

		if (!task) {
			return {
				success: false,
				message: `Task with ID ${input.taskId} not found`,
			};
		}

		await taskService.deleteTask(input.taskId);

		return {
			success: true,
			taskId: input.taskId,
			title: task.title,
			message: `Deleted task: "${task.title}"`,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Failed to delete task: ${errorMessage}`);
	}
}
