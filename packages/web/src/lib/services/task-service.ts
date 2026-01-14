/**
 * Unified Task Service using ApiClient for consistent error handling and retry logic
 * Replaces scattered task CRUD operations and raw fetch calls
 */

import type { Task, TaskStatus } from "@task-manager/db";
import { ApiClient } from "$lib/utils/api-client";

export interface CreateTaskParams {
	workspaceId: string;
	title: string;
	status?: TaskStatus;
	description?: string;
	priority?: string;
	dueDate?: string;
}

export interface UpdateTaskParams {
	status?: TaskStatus;
	title?: string;
	description?: string;
	priority?: string;
	dueDate?: string;
}

export interface TaskListResponse {
	success: boolean;
	data: {
		items: Task[];
		total: number;
	};
}

export class TaskService {
	private apiClient: ApiClient;

	constructor() {
		this.apiClient = new ApiClient({
			defaultHeaders: {
				"Content-Type": "application/json",
			},
		});
	}

	/**
	 * Create a new task
	 */
	async createTask(params: CreateTaskParams): Promise<Task> {
		const response = await this.apiClient.post<Task>(
			"/api/tasks",
			{
				workspaceId: params.workspaceId,
				title: params.title.trim(),
				status: params.status || "todo",
				description: params.description,
				priority: params.priority,
				dueDate: params.dueDate,
			},
			{
				retryType: "api_call",
				context: { operation: "create_task", workspaceId: params.workspaceId },
			},
		);

		return response;
	}

	/**
	 * Fetch tasks for a workspace
	 */
	async fetchTasks(workspaceId: string): Promise<Task[]> {
		const response = await this.apiClient.get<TaskListResponse>(
			`/api/tasks?workspaceId=${workspaceId}`,
			{
				retryType: "api_call",
				context: { operation: "fetch_tasks", workspaceId },
			},
		);

		return response.success ? response.data.items : [];
	}

	/**
	 * Update an existing task
	 */
	async updateTask(taskId: string, updates: UpdateTaskParams): Promise<Task> {
		const response = await this.apiClient.patch<Task>(
			`/api/tasks/${taskId}`,
			updates,
			{
				retryType: "api_call",
				context: { operation: "update_task", taskId },
			},
		);

		return response;
	}

	/**
	 * Delete a task
	 */
	async deleteTask(taskId: string): Promise<void> {
		await this.apiClient.delete(`/api/tasks/${taskId}`, {
			retryType: "api_call",
			context: { operation: "delete_task", taskId },
		});
	}

	/**
	 * Get a single task by ID
	 */
	async getTask(taskId: string): Promise<Task> {
		const response = await this.apiClient.get<{ task: Task }>(
			`/api/tasks/${taskId}`,
			{
				retryType: "api_call",
				context: { operation: "get_task", taskId },
			},
		);

		return response.task;
	}

	/**
	 * Toggle task status between todo and done
	 */
	async toggleTaskStatus(
		taskId: string,
		currentStatus: TaskStatus,
	): Promise<Task> {
		const newStatus: TaskStatus = currentStatus === "done" ? "todo" : "done";
		return this.updateTask(taskId, { status: newStatus });
	}
}

// Export singleton instance
export const taskService = new TaskService();
