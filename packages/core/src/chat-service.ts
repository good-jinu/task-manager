import type { Task, TaskService } from "@notion-task-manager/db";
import {
	type TaskAgentExecuteParams,
	TaskManagerAgent,
} from "./agent/task-manager-agent";

export interface ChatResponse {
	success: boolean;
	content: string;
	tasks?: Task[];
	error?: string;
}

/**
 * ChatService handles AI-powered task management conversations
 */
export class ChatService {
	private agent = new TaskManagerAgent();

	/**
	 * Process a chat message and return appropriate response
	 */
	async processMessage(
		message: string,
		workspaceId: string,
		userId: string,
		taskService: TaskService,
		contextTasks: Task[] = [],
		executionId?: string,
	): Promise<ChatResponse> {
		try {
			const params: TaskAgentExecuteParams = {
				userId,
				executionId: executionId || crypto.randomUUID(),
				workspaceId,
				query: message.trim(),
				contextTasks,
				taskService,
			};

			const result = await this.agent.execute(params);

			return {
				success: result.action !== "none",
				content: result.message,
				tasks: result.tasks,
				error: result.action === "none" ? result.reasoning : undefined,
			};
		} catch (error) {
			console.error("Chat service error:", error);
			return {
				success: false,
				content:
					"I encountered an error processing your request. Please try again.",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}
