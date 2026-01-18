import { z } from "zod";
import type { TaskToolCommonArgs } from "./task-common";

/**
 * Input schema for creating a task
 */
export const createTaskInputSchema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	dueDate: z.string().optional(),
	status: z.enum(["todo", "in-progress", "done", "archived"]).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/**
 * Execute task creation
 */
export async function executeCreateTask(
	args: TaskToolCommonArgs & { input: CreateTaskInput },
) {
	console.log("[executeCreateTask] Starting task creation:", args.input);
	const { workspaceId, taskService, input } = args;

	try {
		console.log("[executeCreateTask] Creating task in workspace:", workspaceId);
		const task = await taskService.createTask({
			workspaceId,
			title: input.title,
			content: input.content,
			priority: input.priority,
			dueDate: input.dueDate,
			status: input.status || "todo",
		});

		console.log("[executeCreateTask] Task created successfully:", {
			taskId: task.id,
			title: task.title,
		});

		return {
			success: true,
			taskId: task.id,
			title: task.title,
			status: task.status,
			priority: task.priority,
			dueDate: task.dueDate,
			message: `Created task: "${task.title}"`,
		};
	} catch (error) {
		console.error("[executeCreateTask] Task creation failed:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Failed to create task: ${errorMessage}`);
	}
}
