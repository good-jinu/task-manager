import { createAIAgentService } from "@notion-task-manager/core";
import { type Task, TaskService } from "@notion-task-manager/db";
import {
	CHAT_LIMITS,
	ERROR_MESSAGES,
	QUERY_KEYWORDS,
	SUCCESS_MESSAGES,
	TASK_CREATION_KEYWORDS,
} from "$lib/constants/chat";

export interface ChatResponse {
	success: boolean;
	content: string;
	tasks?: Task[];
	error?: string;
}

interface ParsedTask {
	title: string;
	content?: string;
	priority?: string;
	dueDate?: string;
	confidence: number;
}

export class ChatService {
	private aiService = createAIAgentService();
	private taskService = new TaskService();

	/**
	 * Process a chat message and return appropriate response
	 */
	async processMessage(
		message: string,
		workspaceId: string,
		userId: string,
	): Promise<ChatResponse> {
		try {
			const messageContent = message.trim();

			// Determine intent based on keywords
			const isTaskCreation = this.isTaskCreationIntent(messageContent);
			const isQuery = this.isQueryIntent(messageContent);

			if (isTaskCreation) {
				return await this.handleTaskCreation(
					messageContent,
					workspaceId,
					userId,
				);
			} else if (isQuery) {
				return await this.handleTaskQuery(messageContent, workspaceId, userId);
			} else {
				return this.handleGeneralConversation();
			}
		} catch (error) {
			console.error("Chat service error:", error);
			return {
				success: false,
				content: ERROR_MESSAGES.GENERAL_ERROR,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Check if message indicates task creation intent
	 */
	private isTaskCreationIntent(message: string): boolean {
		const lowerMessage = message.toLowerCase();
		return TASK_CREATION_KEYWORDS.some((keyword) =>
			lowerMessage.includes(keyword.toLowerCase()),
		);
	}

	/**
	 * Check if message indicates query intent
	 */
	private isQueryIntent(message: string): boolean {
		const lowerMessage = message.toLowerCase();
		return QUERY_KEYWORDS.some((keyword) =>
			lowerMessage.includes(keyword.toLowerCase()),
		);
	}

	/**
	 * Handle task creation requests
	 */
	private async handleTaskCreation(
		message: string,
		workspaceId: string,
		userId: string,
	): Promise<ChatResponse> {
		try {
			const parsedTask = await this.aiService.parseNaturalLanguageTask(message);

			if (
				parsedTask &&
				parsedTask.confidence > CHAT_LIMITS.TASK_CONFIDENCE_THRESHOLD
			) {
				const newTask = await this.taskService.createTask({
					title: parsedTask.title,
					content: parsedTask.content,
					priority: parsedTask.priority,
					dueDate: parsedTask.dueDate,
					workspaceId: workspaceId,
				});

				const responseContent = this.formatTaskCreationResponse(parsedTask);

				return {
					success: true,
					content: responseContent,
					tasks: [newTask],
				};
			} else {
				return {
					success: true,
					content: SUCCESS_MESSAGES.NEED_MORE_INFO,
				};
			}
		} catch (error) {
			console.error("Task creation failed:", error);
			this.logError("Task creation", { userId, workspaceId, message }, error);

			return {
				success: false,
				content: ERROR_MESSAGES.TASK_CREATION_FAILED,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Handle task query requests
	 */
	private async handleTaskQuery(
		message: string,
		workspaceId: string,
		userId: string,
	): Promise<ChatResponse> {
		try {
			const allTasks = await this.taskService.listTasks(workspaceId, {
				limit: 100,
			});

			const foundTasks = this.filterTasksByQuery(allTasks.items, message);

			if (foundTasks.length > 0) {
				const limitedTasks = foundTasks.slice(0, CHAT_LIMITS.MAX_QUERY_RESULTS);
				const responseContent = this.formatTaskQueryResponse(limitedTasks);

				return {
					success: true,
					content: responseContent,
					tasks: limitedTasks,
				};
			} else {
				return {
					success: true,
					content: SUCCESS_MESSAGES.NO_TASKS_FOUND,
				};
			}
		} catch (error) {
			console.error("Task query failed:", error);
			this.logError(
				"Task query",
				{ userId, workspaceId, query: message },
				error,
			);

			return {
				success: false,
				content: ERROR_MESSAGES.TASK_QUERY_FAILED,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Handle general conversation
	 */
	private handleGeneralConversation(): ChatResponse {
		return {
			success: true,
			content: SUCCESS_MESSAGES.HELP,
		};
	}

	/**
	 * Filter tasks based on query text
	 */
	private filterTasksByQuery(tasks: Task[], query: string): Task[] {
		const queryLower = query.toLowerCase();
		return tasks.filter(
			(task) =>
				task.title.toLowerCase().includes(queryLower) ||
				task.content?.toLowerCase().includes(queryLower) ||
				task.status?.toLowerCase().includes(queryLower) ||
				task.priority?.toLowerCase().includes(queryLower),
		);
	}

	/**
	 * Format task creation response
	 */
	private formatTaskCreationResponse(parsedTask: ParsedTask): string {
		let response = `I've created a task for you: "${parsedTask.title}"`;

		if (parsedTask.content) {
			response += `\n\nDetails: ${parsedTask.content}`;
		}

		if (parsedTask.priority) {
			response += `\nPriority: ${parsedTask.priority}`;
		}

		if (parsedTask.dueDate) {
			response += `\nDue: ${new Date(parsedTask.dueDate).toLocaleDateString()}`;
		}

		response += "\n\nIs there anything else you'd like me to help you with?";

		return response;
	}

	/**
	 * Format task query response
	 */
	private formatTaskQueryResponse(tasks: Task[]): string {
		const taskList = tasks
			.map((task, index) => `${index + 1}. ${task.title} (${task.status})`)
			.join("\n");

		return `I found ${tasks.length} task${tasks.length > 1 ? "s" : ""} matching your query:

${taskList}

Would you like me to help you with any of these tasks?`;
	}

	/**
	 * Log detailed error information
	 */
	private logError(
		operation: string,
		context: Record<string, unknown>,
		error: unknown,
	): void {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(`${operation} error details:`, {
			...context,
			error: errorMessage,
			timestamp: new Date().toISOString(),
		});
	}
}
